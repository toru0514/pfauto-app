import { ProductEditForm } from "@/components/products/product-edit-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <ProductEditForm productId={decodeURIComponent(id)} />
      </div>
    </main>
  );
}
