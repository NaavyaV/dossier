import { describe, expect, it } from "vitest";
import { ProviderProfile } from "@/lib/schema/profile";
import { apifyDate, mapApify } from "./apify";
import { splitDateRange, toPartialDate, classifyLink } from "./util";

describe("util", () => {
  it("parses many date shapes", () => {
    expect(toPartialDate("2019")).toEqual({ year: 2019 });
    expect(toPartialDate("2019-03")).toEqual({ year: 2019, month: 3 });
    expect(toPartialDate("2019-03-05T00:00:00Z")).toEqual({ year: 2019, month: 3, day: 5 });
    expect(toPartialDate("Mar 2019")).toEqual({ year: 2019, month: 3 });
    expect(toPartialDate("03/2019")).toEqual({ year: 2019, month: 3 });
    expect(toPartialDate({ year: 2020, month: "6" })).toEqual({ year: 2020, month: 6 });
    expect(toPartialDate("Present")).toBeUndefined();
    expect(toPartialDate("garbage")).toBeUndefined();
    expect(toPartialDate("1800")).toBeUndefined();
  });
  it("splits ranges", () => {
    expect(splitDateRange("Aug 2019 - Present")).toEqual({ start: { year: 2019, month: 8 }, current: true });
    expect(splitDateRange("2015 – 2019")).toEqual({ start: { year: 2015 }, end: { year: 2019 } });
  });
  it("classifies links", () => {
    expect(classifyLink("https://github.com/x")).toBe("github");
    expect(classifyLink("https://x.com/x")).toBe("twitter");
    expect(classifyLink("https://en.wikipedia.org/wiki/X")).toBe("wikipedia");
    expect(classifyLink("https://example.org")).toBe("website");
  });
});

describe("Apify mapper", () => {
  it("parses HarvestAPI month names and Present", () => {
    expect(apifyDate({ month: "Jan", year: 2024, text: "Jan 2024" })).toEqual({ year: 2024, month: 1 });
    expect(apifyDate({ text: "Present" })).toBeUndefined();
  });

  it("maps a profile and drops contact fields", () => {
    const p = mapApify({
      firstName: "Towhid",
      lastName: "Rahman",
      headline: "Pharmacology",
      about: "Eight years in.",
      photo: "https://media.example/t.jpg",
      email: "towhid@example.com",
      mobileNumber: "+1 555 0100",
      location: { linkedinText: "Los Angeles, California, United States" },
      linkedinUrl: "https://www.linkedin.com/in/towhid-rahman",
      currentPosition: [{ companyName: "CVS Health" }],
      experience: [
        {
          position: "Staff Pharmacist",
          companyName: "CVS Health",
          companyLinkedinUrl: "https://www.linkedin.com/company/cvshealth/",
          employmentType: "Full-time",
          location: "Thousand Oaks",
          startDate: { month: "Jan", year: 2024, text: "Jan 2024" },
          endDate: { text: "Present" },
          description: "Exceeded targets by 15%.",
        },
      ],
      education: [
        {
          schoolName: "Khulna University",
          degree: "Bachelor of Science",
          fieldOfStudy: "Biotechnology",
          startDate: { month: "Aug", year: 2001 },
          endDate: { month: "May", year: 2005 },
        },
      ],
      skills: [{ name: "Medication Safety", endorsements: "1 endorsement" }],
      certifications: [{ title: "Excel Essential Training", issuedBy: "LinkedIn", issuedAt: "Issued Sep 2023" }],
      projects: [{ title: "CVD medicines", description: "A study.", startDate: { month: "Jan", year: 2022 }, endDate: { month: "May", year: 2022 } }],
      volunteering: [{ role: "Immunizer", organizationName: "CSHP", cause: "Health" }],
      publications: [{ title: "Evidence-Based CVD", publishedAt: "Sep 5, 2023", link: "https://example.org/paper" }],
    });
    expect(ProviderProfile.parse(p)).toBeTruthy();
    expect(p.fullName).toBe("Towhid Rahman");
    expect(p.location).toBe("Los Angeles, California, United States");
    expect(p.currentCompany).toBe("CVS Health");
    expect(p.experience?.[0]).toMatchObject({ title: "Staff Pharmacist", company: "CVS Health", current: true, start: { year: 2024, month: 1 } });
    expect(p.education?.[0]).toMatchObject({ school: "Khulna University", field: "Biotechnology", end: { year: 2005, month: 5 } });
    expect(p.skills?.[0]).toMatchObject({ name: "Medication Safety", endorsements: 1 });
    expect(p.certifications?.[0]).toMatchObject({ name: "Excel Essential Training", issuer: "LinkedIn" });
    expect(p.projects?.[0]).toMatchObject({ name: "CVD medicines", end: { year: 2022, month: 5 } });
    expect(p.volunteer?.[0]).toMatchObject({ role: "Immunizer", organization: "CSHP" });
    expect(p.publications?.[0]?.url).toBe("https://example.org/paper");
    expect(JSON.stringify(p)).not.toMatch(/555 0100|towhid@example/);
  });
});
