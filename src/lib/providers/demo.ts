import { boolFromEnv, type RuntimeEnv } from "@/lib/infra/env";
import type { ProviderProfile } from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";

/**
 * Demo fixtures — synthetic data for a fictional person so the dossier UI can be
 * explored without API keys. Only answers the `demo` slug. Two fixtures are
 * registered to exercise corroboration and conflict handling in the merger.
 */

export const DEMO_SLUG = "demo";

const primary: ProviderProfile = {
  fullName: "Priya Raman",
  photoUrl: "https://api.dicebear.com/9.x/notionists-neutral/svg?seed=priya-raman&backgroundColor=e8edf3",
  headline: "Staff Engineer, Payments Infrastructure at Meridian · ex-Stripe",
  location: "Toronto, Ontario, Canada",
  currentTitle: "Staff Engineer",
  currentCompany: "Meridian",
  about:
    "I build the boring, load-bearing parts of money movement: ledgers, idempotency, reconciliation. Ten years across fintech and marketplaces. I care about systems that fail loudly and recover quietly, and about teams where the newest engineer can ship on day three.",
  experience: [
    {
      title: "Staff Engineer, Payments Infrastructure",
      company: "Meridian",
      companyUrl: "https://example.com/meridian",
      location: "Toronto, Canada · Hybrid",
      employmentType: "Full-time",
      start: { year: 2023, month: 4 },
      current: true,
      description:
        "Own the double-entry ledger service (≈40k TPS peak) and the settlement pipeline for 14 currencies. Led the migration from batch to streaming reconciliation, cutting break detection from 26h to under 4 minutes.",
    },
    {
      title: "Senior Software Engineer",
      company: "Stripe",
      companyUrl: "https://stripe.com",
      location: "Toronto, Canada",
      employmentType: "Full-time",
      start: { year: 2019, month: 8 },
      end: { year: 2023, month: 3 },
      description:
        "Treasury and money-movement APIs. Designed the retry/idempotency framework adopted across three product teams; on-call lead for the ACH rails.",
    },
    {
      title: "Software Engineer",
      company: "Shopify",
      companyUrl: "https://shopify.com",
      location: "Ottawa, Canada",
      start: { year: 2016, month: 6 },
      end: { year: 2019, month: 7 },
      description: "Checkout and Shop Pay. Shipped installment payments to CA/US merchants.",
    },
    {
      title: "Software Developer Intern",
      company: "Shopify",
      location: "Ottawa, Canada",
      employmentType: "Internship",
      start: { year: 2015, month: 5 },
      end: { year: 2015, month: 8 },
    },
  ],
  education: [
    {
      school: "University of Waterloo",
      degree: "BASc, Software Engineering",
      field: "Software Engineering",
      start: { year: 2011 },
      end: { year: 2016 },
      description: "Co-op program. Capstone: fault-injection tooling for distributed key-value stores.",
    },
  ],
  skills: [
    { name: "Distributed systems", endorsements: 61 },
    { name: "Payments", endorsements: 54 },
    { name: "Go", endorsements: 47 },
    { name: "PostgreSQL", endorsements: 39 },
    { name: "Kafka", endorsements: 33 },
    { name: "Ledger design" },
    { name: "Incident response" },
    { name: "Ruby" },
    { name: "Technical leadership" },
    { name: "System design" },
  ],
  certifications: [
    {
      name: "AWS Certified Solutions Architect – Professional",
      issuer: "Amazon Web Services",
      issued: { year: 2022, month: 2 },
      expires: { year: 2025, month: 2 },
      credentialId: "AWS-PSA-7F3K2",
    },
  ],
  projects: [
    {
      name: "ledgerkit",
      description: "Open-source double-entry ledger primitives for Go with strong idempotency guarantees. ★ 1,240",
      url: "https://github.com/priya-raman-fixture/ledgerkit",
      start: { year: 2021 },
    },
    {
      name: "Streaming reconciliation",
      description: "Internal platform replacing nightly batch reconciliation with an event-sourced matcher.",
      start: { year: 2023, month: 9 },
      end: { year: 2024, month: 6 },
    },
  ],
  publications: [
    {
      title: "Idempotency is a Product Decision",
      publisher: "Increment",
      published: { year: 2021, month: 10 },
      url: "https://example.com/increment/idempotency",
      description: "On the mismatch between how APIs promise idempotency and how clients actually retry.",
    },
  ],
  volunteer: [
    {
      role: "Mentor",
      organization: "Technovation Toronto",
      cause: "Education",
      start: { year: 2020 },
      description: "Coach two high-school teams a year through building and pitching a mobile app.",
    },
  ],
  links: [
    { network: "linkedin", url: "https://www.linkedin.com/in/demo" },
    { network: "github", url: "https://github.com/priya-raman-fixture", handle: "priya-raman-fixture" },
    { network: "website", url: "https://priyaraman.dev" },
    { network: "twitter", url: "https://x.com/priya_ledgers", handle: "priya_ledgers" },
  ],
};

/** A second, staler source that agrees on most things and disagrees on one. */
const secondary: ProviderProfile = {
  fullName: "Priya Raman",
  headline: "Senior Software Engineer at Stripe",
  location: "Toronto, Canada",
  currentTitle: "Senior Software Engineer",
  currentCompany: "Stripe",
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Stripe",
      start: { year: 2019, month: 8 },
      end: { year: 2023, month: 3 },
    },
    {
      title: "Software Engineer",
      company: "Shopify Inc.",
      start: { year: 2016 },
      end: { year: 2019 },
    },
  ],
  education: [{ school: "University of Waterloo", degree: "Bachelor of Applied Science" }],
  skills: [{ name: "Go" }, { name: "Postgres" }, { name: "Apache Kafka" }, { name: "Payments" }],
  links: [
    { network: "github", url: "https://github.com/priya-raman-fixture" },
    { network: "website", url: "https://priyaraman.dev/" },
  ],
};

function make(
  id: string,
  label: string,
  fixture: ProviderProfile,
  baseConfidence: number,
  observedAt: string,
  env: RuntimeEnv,
): ProfileProvider {
  const enabled = boolFromEnv(env.ENABLE_DEMO_PROVIDER, true);
  return {
    id,
    label,
    phase: "primary",
    baseConfidence,
    license: "Synthetic fixture — fictional person",
    isEnabled: () => enabled,
    disabledReason: () => "ENABLE_DEMO_PROVIDER=false",
    async lookup(input: LookupInput, _ctx: LookupContext): Promise<ProviderOutcome> {
      const meta = { provider: id, label, observedAt, baseConfidence, license: "Synthetic fixture — fictional person", synthetic: true };
      if (input.slug !== DEMO_SLUG) return { status: "skipped", note: "Only answers the demo handle." };
      return { status: "ok", profile: fixture, meta };
    },
  };
}

export function createDemoProviders(env: RuntimeEnv): ProfileProvider[] {
  const now = Date.now();
  return [
    make("demo-a", "Demo fixture A", primary, 0.9, new Date(now - 2 * 86_400_000).toISOString(), env),
    make("demo-b", "Demo fixture B (stale)", secondary, 0.7, new Date(now - 400 * 86_400_000).toISOString(), env),
  ];
}
