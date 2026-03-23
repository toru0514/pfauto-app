import { getWoods } from "./actions";
import { WoodsContent } from "@/components/woods/woods-content";

export const dynamic = "force-dynamic";

export default async function WoodsPage() {
  const woods = await getWoods();
  return <WoodsContent woods={woods} />;
}
