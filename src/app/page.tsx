import { loadMoversPayload } from "@/lib/movers-loader";
import MoversView from "./MoversView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initial = await loadMoversPayload();
  return <MoversView initial={initial} />;
}
