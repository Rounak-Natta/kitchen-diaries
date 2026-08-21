import { create } from "zustand";

interface CategoryStore {
  selectedCategoryId:
    string | null;

  setSelectedCategoryId: (
    categoryId: string | null,
  ) => void;
}

export const useCategoryStore =
  create<CategoryStore>((set) => ({
    selectedCategoryId: null,

    setSelectedCategoryId:
      (categoryId) =>
        set({
          selectedCategoryId:
            categoryId,
        }),
  }));