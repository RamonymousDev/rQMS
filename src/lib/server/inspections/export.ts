import { error } from '@sveltejs/kit';
import { and, asc, count, type SQL } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { PassThrough, type Stream } from 'node:stream';
import { db } from '../db/index.js';
import { inspections } from '../db/schema.js';
import { buildFilters } from './reports.js';

/** Batas aman jumlah inspeksi per export — request lebih besar ditolak sebelum file dibuat. */
export const EXPORT_MAX_INSPECTIONS = 50_000;

type InspectionRow = Awaited<ReturnType<typeof queryInspections>>[number];

const STATUS_OK = 'OK';
const STATUS_NG = 'NG';

const SHEET_MAIN = 'Inspeksi';
const SHEET_POINTS = 'Points';
const SHEET_HARDWARES = 'Hardwares';
const SHEET_LENGTHS = 'Lengths';
const SHEET_SUMMARY = 'Ringkasan';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}

function formatWib(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
		d.getMinutes()
	)}`;
}

/** Nama file: prefix + timestamp waktu Jakarta. */
export function buildFilename(now = new Date()): string {
	const j = new Date(now.getTime() + WIB_OFFSET_MS);
	return `hasil-inspeksi_${j.getUTCFullYear()}${pad2(j.getUTCMonth() + 1)}${pad2(j.getUTCDate())}_${pad2(
		j.getUTCHours()
	)}${pad2(j.getUTCMinutes())}${pad2(j.getUTCSeconds())}.xlsx`;
}

function describeFilters(params: URLSearchParams): { label: string; value: string }[] {
	const entries: { label: string; value: string }[] = [];

	const dateFrom = params.get('dateFrom')?.trim();
	const dateTo = params.get('dateTo')?.trim();
	if (dateFrom && dateTo) entries.push({ label: 'Periode', value: `${dateFrom} s/d ${dateTo}` });
	else if (dateFrom) entries.push({ label: 'Dari Tanggal', value: dateFrom });
	else if (dateTo) entries.push({ label: 'Sampai Tanggal', value: dateTo });

	const map: [string, string][] = [
		['partNo', 'Part No'],
		['lineCode', 'Line'],
		['stage', 'Stage'],
		['shift', 'Shift'],
		['status', 'Status']
	];
	for (const [key, label] of map) {
		const value = params.get(key)?.trim();
		if (value) entries.push({ label, value });
	}

	return entries;
}

function queryInspections(filters: SQL[]) {
	const where = filters.length ? and(...filters) : undefined;
	return db.query.inspections.findMany({
		where,
		orderBy: [asc(inspections.inspectedAt)],
		with: {
			operator: { columns: { nik: true, name: true } },
			points: { orderBy: (p) => [asc(p.pointNo)] },
			hardwares: { orderBy: (h) => [asc(h.hwNo)] },
			lengths: { orderBy: (l) => [asc(l.lengthNo)] }
		}
	});
}

function countInspections(filters: SQL[]) {
	const where = filters.length ? and(...filters) : undefined;
	return db.select({ value: count() }).from(inspections).where(where);
}

function styleHeaderCell(cell: ExcelJS.Cell): void {
	cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
	cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function styleStatusCell(cell: ExcelJS.Cell, status: string | null | undefined): void {
	if (status === STATUS_NG) {
		cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
	} else if (status === STATUS_OK) {
		cell.font = { color: { argb: 'FF15803D' }, bold: true };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
	}
}

async function writeDataSheet(
	wb: ExcelJS.stream.xlsx.WorkbookWriter,
	name: string,
	columns: { header: string; width: number }[],
	rows: (string | number | null)[][],
	statusColumnIndex?: number
): Promise<void> {
	const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
	// Jangan set properti `header` di columns — itu otomatis menulis header row
	// (ganda). Header ditulis manual di bawah supaya bisa diberi style.
	ws.columns = columns.map((c) => ({ width: c.width }));

	const header = ws.addRow(columns.map((c) => c.header));
	header.eachCell((cell) => styleHeaderCell(cell));
	header.commit();

	for (const rowData of rows) {
		const row = ws.addRow(rowData);
		if (statusColumnIndex && statusColumnIndex >= 1) {
			const cell = row.getCell(statusColumnIndex);
			styleStatusCell(cell, typeof cell.value === 'string' ? cell.value : undefined);
		}
		row.commit();
	}

	await ws.commit();
}

async function buildWorkbook(
	stream: Stream,
	rows: InspectionRow[],
	filterLabels: { label: string; value: string }[]
): Promise<void> {
	const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });

	// --- Ringkasan
	const summary = wb.addWorksheet(SHEET_SUMMARY);
	summary.columns = [{ width: 24 }, { width: 40 }];
	const total = rows.length;
	const ok = rows.filter((r) => r.overallStatus === STATUS_OK).length;
	const ng = total - ok;

	const title = summary.addRow(['Ringkasan Export Inspeksi']);
	title.getCell(1).font = { bold: true, size: 14 };
	title.commit();

	const summaryRows: [string, string | number][] = [
		['Total Inspeksi', total],
		['Status OK', ok],
		['Status NG', ng],
		['Waktu Export (WIB)', formatWib(new Date(new Date().getTime() + WIB_OFFSET_MS))]
	];
	if (filterLabels.length) {
		summaryRows.push(['Filter', '']);
		for (const f of filterLabels) summaryRows.push([`  ${f.label}`, f.value]);
	}
	for (const [label, value] of summaryRows) {
		const row = summary.addRow([label, value]);
		row.getCell(1).font = { bold: label === 'Filter' };
		row.commit();
	}
	await summary.commit();

	// --- Inspeksi (header)
	const mainColumns = [
		{ header: 'No', width: 6 },
		{ header: 'Waktu (WIB)', width: 17 },
		{ header: 'Part No', width: 14 },
		{ header: 'Line', width: 10 },
		{ header: 'Stage', width: 10 },
		{ header: 'Shift', width: 8 },
		{ header: 'Operator NIK', width: 14 },
		{ header: 'Operator', width: 22 },
		{ header: 'Overall', width: 10 },
		{ header: 'Spot Actual', width: 12 },
		{ header: 'Visual', width: 9 },
		{ header: 'Visual Remarks', width: 30 },
		{ header: 'Jumlah Item NG', width: 14 }
	];
	const mainRows = rows.map((r, i) => {
		const itemNg =
			(r.visualStatus === STATUS_NG ? 1 : 0) +
			r.points.filter((p) => p.status === STATUS_NG).length +
			r.hardwares.filter((h) => h.status === STATUS_NG).length +
			r.lengths.filter((l) => l.status === STATUS_NG).length;
		return [
			i + 1,
			formatWib(r.inspectedAt),
			r.partNo,
			r.lineCode,
			r.stage,
			r.shift,
			r.operator?.nik ?? '',
			r.operator?.name ?? r.operatorName,
			r.overallStatus,
			r.spotActual ?? '',
			r.visualStatus ?? '',
			r.visualRemarks ?? '',
			itemNg
		];
	});
	await writeDataSheet(wb, SHEET_MAIN, mainColumns, mainRows, 9);

	// --- Points
	const pointColumns = [
		{ header: 'No', width: 6 },
		{ header: 'Waktu (WIB)', width: 17 },
		{ header: 'Part No', width: 14 },
		{ header: 'Line', width: 10 },
		{ header: 'Stage', width: 10 },
		{ header: 'Shift', width: 8 },
		{ header: 'Operator', width: 22 },
		{ header: 'Overall', width: 10 },
		{ header: 'Point No', width: 12 },
		{ header: 'Status', width: 10 },
		{ header: 'Remarks', width: 40 }
	];
	const pointRows = rows.flatMap((r) =>
		r.points.map((p) => [
			r.points.indexOf(p) + 1,
			formatWib(r.inspectedAt),
			r.partNo,
			r.lineCode,
			r.stage,
			r.shift,
			r.operator?.name ?? r.operatorName,
			r.overallStatus,
			p.pointNo,
			p.status,
			p.remarks ?? ''
		])
	);
	await writeDataSheet(wb, SHEET_POINTS, pointColumns, pointRows, 10);

	// --- Hardwares
	const hardwareColumns = [
		{ header: 'No', width: 6 },
		{ header: 'Waktu (WIB)', width: 17 },
		{ header: 'Part No', width: 14 },
		{ header: 'Line', width: 10 },
		{ header: 'Stage', width: 10 },
		{ header: 'Shift', width: 8 },
		{ header: 'Operator', width: 22 },
		{ header: 'Overall', width: 10 },
		{ header: 'HW No', width: 14 },
		{ header: 'HW Name', width: 24 },
		{ header: 'Tipe', width: 10 },
		{ header: 'Ke', width: 6 },
		{ header: 'Standard', width: 10 },
		{ header: 'Unit', width: 8 },
		{ header: 'Actual', width: 10 },
		{ header: 'Status', width: 10 },
		{ header: 'Remarks', width: 40 }
	];
	const hardwareRows = rows.flatMap((r) =>
		r.hardwares.map((h) => [
			r.hardwares.indexOf(h) + 1,
			formatWib(r.inspectedAt),
			r.partNo,
			r.lineCode,
			r.stage,
			r.shift,
			r.operator?.name ?? r.operatorName,
			r.overallStatus,
			h.hwNo,
			h.hwName,
			h.checkType ?? '',
			h.checkNo,
			h.standardValue,
			h.unit,
			h.actualValue,
			h.status,
			h.remarks ?? ''
		])
	);
	await writeDataSheet(wb, SHEET_HARDWARES, hardwareColumns, hardwareRows, 14);

	// --- Lengths
	const lengthColumns = [
		{ header: 'No', width: 6 },
		{ header: 'Waktu (WIB)', width: 17 },
		{ header: 'Part No', width: 14 },
		{ header: 'Line', width: 10 },
		{ header: 'Stage', width: 10 },
		{ header: 'Shift', width: 8 },
		{ header: 'Operator', width: 22 },
		{ header: 'Overall', width: 10 },
		{ header: 'Length No', width: 14 },
		{ header: 'Standard (mm)', width: 14 },
		{ header: 'Actual (mm)', width: 14 },
		{ header: 'Status', width: 10 },
		{ header: 'Remarks', width: 40 }
	];
	const lengthRows = rows.flatMap((r) =>
		r.lengths.map((l) => [
			r.lengths.indexOf(l) + 1,
			formatWib(r.inspectedAt),
			r.partNo,
			r.lineCode,
			r.stage,
			r.shift,
			r.operator?.name ?? r.operatorName,
			r.overallStatus,
			l.lengthNo,
			l.standardMm,
			l.actualMm,
			l.status,
			l.remarks ?? ''
		])
	);
	await writeDataSheet(wb, SHEET_LENGTHS, lengthColumns, lengthRows, 12);

	await wb.commit();
}

/**
 * Generate workbook Excel dari semua inspeksi yang cocok dengan filter.
 * Count-first guard: menolak request > EXPORT_MAX_INSPECTIONS sebelum menulis file.
 */
export async function exportInspectionsXlsx(params: URLSearchParams) {
	const filters = buildFilters(params);

	const [totalRows] = await countInspections(filters);
	if (totalRows.value > EXPORT_MAX_INSPECTIONS) {
		throw error(
			400,
			`Data terlalu besar untuk diexport (${totalRows.value.toLocaleString()} inspeksi, maksimum ${EXPORT_MAX_INSPECTIONS.toLocaleString()}). Persempit filter tanggal atau status terlebih dahulu.`
		);
	}

	const rows = await queryInspections(filters);

	const chunks: Buffer[] = [];
	const pass = new PassThrough();
	pass.on('data', (c: Buffer) => chunks.push(c));

	await buildWorkbook(pass, rows, describeFilters(params));

	const buffer = Buffer.concat(chunks);
	return { buffer, total: totalRows.value, filename: buildFilename() };
}
