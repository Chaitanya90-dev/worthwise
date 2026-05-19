import { supabase } from "./supabaseClient";
import { defaultCategories, defaultPaymentMethods } from "./defaults";

export const seedDefaults = async () => {
  const { data: categoryCheck, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .limit(1);

  if (!categoryError && categoryCheck && categoryCheck.length === 0) {
    await supabase.from("categories").insert(defaultCategories);
  }

  const { data: paymentCheck, error: paymentError } = await supabase
    .from("payment_methods")
    .select("id")
    .limit(1);

  if (!paymentError && paymentCheck && paymentCheck.length === 0) {
    await supabase.from("payment_methods").insert(
      defaultPaymentMethods.map((name) => ({ name }))
    );
  }
};
