"use client";

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";

export function ContactForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "ارسال پیام ناموفق بود", "error");
        return;
      }
      toast("پیام شما با موفقیت ارسال شد", "success");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch {
      toast("خطا در ارسال پیام", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="نام و نام خانوادگی"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
        autoComplete="name"
      />
      <Input
        label="ایمیل"
        type="email"
        dir="ltr"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        required
        autoComplete="email"
      />
      <Input
        label="شماره موبایل (اختیاری)"
        type="tel"
        dir="ltr"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        autoComplete="tel"
      />
      <Input
        label="موضوع"
        value={form.subject}
        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
        required
      />
      <Textarea
        label="پیام"
        rows={5}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        required
      />
      <Button type="submit" fullWidth loading={loading}>
        ارسال پیام
      </Button>
    </form>
  );
}
