import { providerStatus } from "@/lib/providers";

export async function GET() {
  return Response.json({
    service: "ai-media-studio",
    features: {
      image: true,
      video: true,
      frame: true,
      storyboard: true,
      editor: true,
      history: true,
      authentication: true,
    },
    providers: providerStatus(),
  });
}
