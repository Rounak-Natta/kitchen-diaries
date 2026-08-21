import {
  OrderLayout,
} from "@/features/orders/components/order-layout";
import {
  PosAccessGate,
} from "@/features/orders/components/pos-access-gate";

export default function NewOrderPage() {
  return (
    <PosAccessGate>
      <OrderLayout
        menuItems={[]}
        categories={[]}
      />
    </PosAccessGate>
  );
}
