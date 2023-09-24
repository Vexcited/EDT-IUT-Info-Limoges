import { json } from "solid-start/api";

export const GET = () => json({
  success: true,
  data: {
    documentation: "https://github.com/Vexcited/EDT-IUT-Info-Limoges/blob/main/packages/website/README.md",
  }
}, { status: 200 });
