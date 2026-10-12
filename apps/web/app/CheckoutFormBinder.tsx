"use client";

import { useEffect } from "react";

export default function CheckoutFormBinder() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".checkout-form-card");
    if (form) form.id = "checkout-form";
  });

  return null;
}
