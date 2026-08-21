type Props = {
  allowed: boolean
  children: React.ReactNode
}

export function PermissionGuard({
  allowed,
  children,
}: Props) {
  if (!allowed) {
    return null
  }

  return <>{children}</>
}