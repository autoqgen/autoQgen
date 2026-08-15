import { describe, expect, it } from "vitest";

import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates/password-reset";

describe("password reset email", () => {
  const message = passwordResetEmail({
    recipientEmail: "teacher@example.com",
    recipientName: "Tara",
    resetUrl: "https://app.example.com/reset?token=abc123",
    expiresInMinutes: 60,
  });

  it("addresses the recipient and states the expiry", () => {
    expect(message.to).toBe("teacher@example.com");
    expect(message.text).toContain("Tara");
    expect(message.text).toContain("60 minutes");
    expect(message.html).toContain("60 minutes");
  });

  it("keeps the token out of the subject line", () => {
    expect(message.subject).not.toContain("abc123");
  });

  it("provides both a plain-text and an HTML body", () => {
    expect(message.text.length).toBeGreaterThan(0);
    expect(message.html).toContain("<html");
  });

  it("escapes HTML in the recipient name", () => {
    const hostile = passwordResetEmail({
      recipientEmail: "x@example.com",
      recipientName: '<script>alert("x")</script>',
      resetUrl: "https://app.example.com/reset?token=t",
      expiresInMinutes: 60,
    });

    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).toContain("&lt;script&gt;");
  });

  it("escapes the reset URL in the HTML body", () => {
    const tricky = passwordResetEmail({
      recipientEmail: "x@example.com",
      recipientName: "X",
      resetUrl: 'https://app.example.com/reset?token=a"onmouseover="alert(1)',
      expiresInMinutes: 60,
    });

    expect(tricky.html).not.toContain('"onmouseover="');
    expect(tricky.html).toContain("&quot;");
  });

  it("falls back to a friendly greeting for an empty name", () => {
    const anonymous = passwordResetEmail({
      recipientEmail: "x@example.com",
      recipientName: "   ",
      resetUrl: "https://app.example.com/reset?token=t",
      expiresInMinutes: 60,
    });

    expect(anonymous.text).toContain("Hi there,");
  });
});

describe("password changed notification", () => {
  it("tells the user they were signed out everywhere", () => {
    const message = passwordChangedEmail({
      recipientEmail: "x@example.com",
      recipientName: "Tara",
    });

    expect(message.subject).toContain("password was changed");
    expect(message.text).toContain("signed out on all devices");
  });
});
