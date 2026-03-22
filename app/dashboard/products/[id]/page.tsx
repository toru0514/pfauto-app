import { ProductEditForm } from "@/components/products/product-edit-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params;

  return <ProductEditForm productId={decodeURIComponent(id)} />;
}
