import { getWoods } from "./actions";
import { WoodsContent } from "@/components/woods/woods-content";

export default async function WoodsPage() {
  const woods = await getWoods();
  return <WoodsContent woods={woods} />;
}
