"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { EcomSale, WholesaleSale, Manufacturer, PurchaseOrder, Transaction } from "@/lib/types";

interface DataContextType {
  ecomSales: EcomSale[];
  setEcomSales: (val: EcomSale[] | ((prev: EcomSale[]) => EcomSale[])) => void;
  wholesaleSales: WholesaleSale[];
  setWholesaleSales: (val: WholesaleSale[] | ((prev: WholesaleSale[]) => WholesaleSale[])) => void;
  manufacturers: Manufacturer[];
  setManufacturers: (val: Manufacturer[] | ((prev: Manufacturer[]) => Manufacturer[])) => void;
  purchases: PurchaseOrder[];
  setPurchases: (val: PurchaseOrder[] | ((prev: PurchaseOrder[]) => PurchaseOrder[])) => void;
  transactions: Transaction[];
  setTransactions: (val: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  isReady: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [ecomSales, setEcomSales, eReady] = useSupabaseTable<EcomSale>("ecom_sales", "biztrack_sales", []);
  const [wholesaleSales, setWholesaleSales, wReady] = useSupabaseTable<WholesaleSale>("wholesale_sales", "biztrack_wholesale", []);
  const [manufacturers, setManufacturers, mReady] = useSupabaseTable<Manufacturer>("manufacturers", "biztrack_manufacturers", []);
  const [purchases, setPurchases, pReady] = useSupabaseTable<PurchaseOrder>("purchases", "biztrack_purchases", []);
  const [transactions, setTransactions, tReady] = useSupabaseTable<Transaction>("transactions", "biztrack_transactions", []);

  const isReady = eReady && wReady && mReady && pReady && tReady;

  return (
    <DataContext.Provider
      value={{
        ecomSales, setEcomSales,
        wholesaleSales, setWholesaleSales,
        manufacturers, setManufacturers,
        purchases, setPurchases,
        transactions, setTransactions,
        isReady
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
