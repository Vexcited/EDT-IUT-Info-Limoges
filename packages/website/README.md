# EDT IUT Informatique of Limoges - Website

## API

The API is available at [`https://edt-iut-info-limoges.vercel.app/api`](https://edt-iut-info-limoges.vercel.app/api). `/api` will be the entrypoint for the API.

### `GET /`

Make an empty request to this endpoint and the API will always return the following response.

```typescript
interface Response {
  success: true
  
  data: {
    /** URL to this documentation. */
    documentation: string
  }
}
```

## Development

We're using `pnpm` as the main package manager.
Don't forget to install the dependencies using `pnpm install`.

This website only works if you've built the library first. You can do so by running `pnpm --filter edt-iut-info-limoges run build`.

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Starts the development server on [`localhost:3000`](http://localhost:3000/). |
| `pnpm build` | Build for production. |
