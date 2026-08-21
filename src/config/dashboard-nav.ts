import {
  BarChart3,
  BookOpenText,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package2,
  PlusCircle,
  Shapes,
  ShoppingBag,
  SlidersHorizontal,
  ScrollText,
  Settings,
  KeyRound,
  Download,
  Users,
  FileSpreadsheet,
} from "lucide-react";

export const dashboardNav = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
{
  title: "Analytics",
  href: "/analytics",
  icon: BarChart3,
},
  {
    title: "Categories",
    href: "/categories",
    icon: Shapes,
  },

  {
    title: "Menu",
    href: "/menu",
    icon: Package2,
  },

  {
    title: "Variations",
    href: "/variations",
    icon: SlidersHorizontal,
  },

  {
    title: "Addons",
    href: "/addons",
    icon: PlusCircle,
  },

  {
    title: "Orders",
    href: "/orders",
    icon: ShoppingBag,
  },
  {
  title: "Audit Logs",
  href: "/audit-logs",
  icon: ScrollText,
},

  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
  },

  {
    title: "Inventory",
    href: "/inventory",
    icon: Boxes,
  },
  {
  title: "Reports",
  href: "/reports",
  icon: FileSpreadsheet,
},

  {
    title: "Recipes",
    href: "/recipes",
    icon: BookOpenText,
  },
  {
  title: "Users",
  href: "/users",
  icon: Users,
},
{
  title: "Data Export",
  href: "/data-exports",
  icon: Download,
},
{
  title: "Subscription & Device",
  href: "/settings/subscription",
  icon: KeyRound,
},
{
  title: "Settings",
  href: "/settings/restaurant",
  icon: Settings,
},
];