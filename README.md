# Svelte library

Everything you need to build a Svelte library, powered by [`sv`](https://bunjs.com/package/sv).

Read more about creating a library [in the docs](https://svelte.dev/docs/kit/packaging).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
bunx sv create

# create a new project in my-app
bunx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.17.0 create --template library --types ts --add prettier eslint tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:auto" drizzle="database:postgresql+postgresql:postgres.js+docker:no" ai-tools="ide:opencode" --install bun rqms
```

## Developing

Once you've created a project and installed dependencies with `bun install` (or `pbun install` or `yarn`), start a development server:

```sh
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

Everything inside `src/lib` is part of your library, everything inside `src/routes` can be used as a showcase or preview app.

## Building

To build your library:

```sh
bun pack
```

To create a production version of your showcase app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Publishing

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [bun](https://www.bunjs.com):

```sh
bun publish
```
