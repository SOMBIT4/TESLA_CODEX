import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import LocaleSwitcher from "@/components/layout/locale-switcher";
import { LocaleProvider, useI18n } from "@/lib/i18n/locale-context";

function TranslationProbe() {
  const { t } = useI18n();

  return (
    <div>
      <p>{t("auth.signIn")}</p>
      <p>{t("status.completed")}</p>
      <p>{t("fare.estimatedSolo")}</p>
      <p>{t("map.selectPickup")}</p>
      <p>{t("map.selectDestination")}</p>
      <p>{t("map.unavailable")}</p>
      <p>{t("map.accessibleName")}</p>
      <p>{t("map.zone.banani")}</p>
      <p>{t("profile.navLink")}</p>
      <p>{t("profile.fullName")}</p>
      <p>{t("profile.emailAddress")}</p>
      <p>{t("profile.phoneOptional")}</p>
      <p>{t("profile.saveChanges")}</p>
      <p>{t("profile.vehicleTitle")}</p>
      <p>{t("profile.vehicleName")}</p>
      <p>{t("profile.vehicleCapacity")}</p>
      <p>{t("profile.editVehicle")}</p>
      <p>{t("profile.vehicleLocked")}</p>
    </div>
  );
}

describe("localization foundation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders stable English copy before reading the saved locale", () => {
    window.localStorage.setItem("locale", "bn");

    const serverMarkup = renderToString(
      <LocaleProvider>
        <TranslationProbe />
      </LocaleProvider>,
    );

    expect(serverMarkup).toContain("Sign in");
    expect(serverMarkup).toContain("Completed");
    expect(serverMarkup).toContain("Estimated solo fare");
    expect(serverMarkup).toContain("Tap a zone to set pickup");
    expect(serverMarkup).toContain("Tap a zone to set destination");
    expect(serverMarkup).toContain("Map is unavailable");
    expect(serverMarkup).toContain("Dhaka ride zones");
    expect(serverMarkup).toContain("Banani");
    expect(serverMarkup).toContain("Profile");
    expect(serverMarkup).toContain("Full name");
    expect(serverMarkup).toContain("Email address");
    expect(serverMarkup).toContain("Phone number (optional)");
    expect(serverMarkup).toContain("Save changes");
    expect(serverMarkup).toContain("Vehicle details");
    expect(serverMarkup).toContain("Vehicle name");
    expect(serverMarkup).toContain("Vehicle capacity");
    expect(serverMarkup).toContain("Edit vehicle");
    expect(serverMarkup).toContain(
      "Vehicle details are locked while you are online or in an active pool.",
    );
  });

  it("switches to Bangla, persists the choice, and updates document language", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <LocaleSwitcher />
        <TranslationProbe />
      </LocaleProvider>,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "bn",
    );

    await waitFor(() => {
      expect(screen.getByText("সাইন ইন")).toBeVisible();
      expect(screen.getByText("সম্পন্ন")).toBeVisible();
      expect(screen.getByText("আনুমানিক একক ভাড়া")).toBeVisible();
      expect(
        screen.getByText("জোনে ট্যাপ করে পিকআপ নির্বাচন করুন"),
      ).toBeVisible();
      expect(
        screen.getByText("জোনে ট্যাপ করে গন্তব্য নির্বাচন করুন"),
      ).toBeVisible();
      expect(
        screen.getByText(
          "মানচিত্রটি পাওয়া যাচ্ছে না। তালিকা থেকে জোন বেছে নিন।",
        ),
      ).toBeVisible();
      expect(screen.getByText("ঢাকার রাইড জোনের মানচিত্র")).toBeVisible();
      expect(screen.getByText("বনানী")).toBeVisible();
      expect(screen.getByText("প্রোফাইল")).toBeVisible();
      expect(screen.getByText("পুরো নাম")).toBeVisible();
      expect(screen.getByText("ইমেইল ঠিকানা")).toBeVisible();
      expect(screen.getByText("ফোন নম্বর (ঐচ্ছিক)")).toBeVisible();
      expect(screen.getByText("পরিবর্তন সংরক্ষণ")).toBeVisible();
      expect(screen.getByText("গাড়ির তথ্য")).toBeVisible();
      expect(screen.getByText("গাড়ির নাম")).toBeVisible();
      expect(screen.getByText("গাড়ির আসনসংখ্যা")).toBeVisible();
      expect(screen.getByText("গাড়ি সম্পাদনা")).toBeVisible();
      expect(
        screen.getByText(
          "অনলাইনে থাকলে বা সক্রিয় পুলে থাকলে গাড়ির তথ্য পরিবর্তন করা যাবে না।",
        ),
      ).toBeVisible();
      expect(document.documentElement.lang).toBe("bn");
      expect(window.localStorage.getItem("locale")).toBe("bn");
    });
  });

  it("restores a saved Bangla preference after hydration", async () => {
    window.localStorage.setItem("locale", "bn");

    render(
      <LocaleProvider>
        <LocaleSwitcher />
        <TranslationProbe />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("সাইন ইন")).toBeVisible();
      expect(screen.getByRole("combobox", { name: "ভাষা" })).toHaveValue("bn");
    });
  });
});
