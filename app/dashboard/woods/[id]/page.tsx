import { notFound } from "next/navigation";
import { getWoods } from "../actions";
import { WoodDetail } from "@/components/woods/wood-detail";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WoodDetailPage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const woods = await getWoods();
  const wood = woods.find((w) => w.id === decodedId);

  if (!wood) {
    notFound();
  }

  return <WoodDetail wood={wood} />;
}
