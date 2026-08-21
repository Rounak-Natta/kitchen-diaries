import Link from "next/link";

interface RecipeRuleListItem {
  id: string;
  name: string;
  description: string;
  ruleCount: number;
  href: string;
}

interface RecipeRuleListProps {
  items: RecipeRuleListItem[];
  canEdit: boolean;
  emptyMessage: string;
}

export function RecipeRuleList({
  items,
  canEdit,
  emptyMessage,
}: RecipeRuleListProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">
                Name
              </th>

              <th className="px-4 py-3 font-medium">
                Details
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Rules
              </th>

              <th className="px-4 py-3 font-medium">
                Status
              </th>

              <th className="px-4 py-3 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-muted/20"
              >
                <td className="px-4 py-4 font-medium">
                  {item.name}
                </td>

                <td className="px-4 py-4 text-muted-foreground">
                  {item.description}
                </td>

                <td className="px-4 py-4 text-right font-semibold">
                  {item.ruleCount}
                </td>

                <td className="px-4 py-4">
                  <span
                    className={
                      item.ruleCount > 0
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                    }
                  >
                    {item.ruleCount > 0
                      ? "Configured"
                      : "Not Configured"}
                  </span>
                </td>

                <td className="px-4 py-4 text-right">
                  {canEdit ? (
                    <Link
                      href={item.href}
                      className="rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                    >
                      Configure
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      View only
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}