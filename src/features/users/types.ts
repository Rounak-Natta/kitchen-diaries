import type {
  Role,
} from "@prisma/client";

export interface RestaurantUserListItemDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;

  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantUserEditorDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}