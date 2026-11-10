"use client";

import { useParams } from "next/navigation";
import { AdminProductPageClient } from "../../../../components/AdminProductPageClient";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  return <AdminProductPageClient productId={params.id} />;
}
