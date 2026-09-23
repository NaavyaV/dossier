import { describe, expect, it } from "vitest";
import { ProviderProfile } from "@/lib/schema/profile";
import { mapPdl } from "./pdl";
import { mapRapid } from "./rapidapi";
import { extractJsonLd, mapPersonLd } from "./public-page";
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

describe("PDL mapper", () => {
  it("maps a representative response and drops contact PII", () => {
    const p = mapPdl({
      full_name: "jane doe",
      job_title: "cto",
      job_company_name: "acme",
      location_name: "austin, texas, united states",
      summary: "Builder.",
      work_email: "jane@acme.example",
      mobile_phone: "+1 555 0100",
      experience: [
        { company: { name: "Acme", website: "acme.example" }, title: { name: "CTO" }, start_date: "2021-02", is_primary: true },
        { company: { name: "Globex" }, title: { name: "Engineer" }, start_date: "2016", end_date: "2021-01" },
      ],
      education: [{ school: { name: "MIT" }, degrees: ["bachelors"], majors: ["computer science"], end_date: "2015" }],
      skills: ["rust", "leadership"],
      certifications: [{ name: "CKA", organization: "CNCF", start_date: "2022-05" }],
      profiles: [{ network: "github", url: "github.com/janedoe", username: "janedoe" }],
    });
    expect(ProviderProfile.parse(p)).toBeTruthy();
    expect(p.fullName).toBe("jane doe");
    expect(p.experience).toHaveLength(2);
    expect(p.experience?.[0]).toMatchObject({ company: "Acme", title: "CTO", current: true, companyUrl: "https://acme.example/" });
    expect(p.education?.[0]).toMatchObject({ school: "MIT", degree: "bachelors", field: "computer science", end: { year: 2015 } });
    expect(p.certifications?.[0]).toMatchObject({ name: "CKA", issuer: "CNCF", issued: { year: 2022, month: 5 } });
    expect(p.links?.[0]).toMatchObject({ network: "github", handle: "janedoe" });
    expect(JSON.stringify(p)).not.toMatch(/acme\.example"|555 0100|work_email/);
  });
});

describe("RapidAPI mapper", () => {
  it("tolerates alternate key names and date ranges", () => {
    const p = mapRapid({
      full_name: "Sam Lee",
      headline: "Designer",
      city: "Berlin",
      country: "Germany",
      profile_image_url: "https://img.example/s.jpg",
      experiences: [{ company: "Studio", title: "Lead", date_range: "Jan 2020 - Present", location: "Berlin" }],
      educations: [{ school: "UdK", degree: "MA", field_of_study: "Design", date_range: "2014 - 2016" }],
      skills: "Figma | Motion",
      volunteers: [{ company: "Red Cross", title: "Volunteer", date_range: "2018 - 2019" }],
      publications: [{ title: "On Grids", publisher: "A List Apart", date: "2021-06", link: "https://alistapart.example/grids" }],
    });
    expect(ProviderProfile.parse(p)).toBeTruthy();
    expect(p.location).toBe("Berlin, Germany");
    expect(p.experience?.[0]).toMatchObject({ company: "Studio", title: "Lead", current: true, start: { year: 2020, month: 1 } });
    expect(p.education?.[0]).toMatchObject({ school: "UdK", start: { year: 2014 }, end: { year: 2016 } });
    expect(p.skills?.map((s) => s.name)).toEqual(["Figma", "Motion"]);
    expect(p.volunteer?.[0]).toMatchObject({ organization: "Red Cross", role: "Volunteer" });
    expect(p.publications?.[0]).toMatchObject({ title: "On Grids", published: { year: 2021, month: 6 } });
  });
});

describe("public page JSON-LD", () => {
  it("extracts and maps a Person block", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"http://schema.org","@graph":[{"@type":"Person","name":"Ada Example","jobTitle":"Engineer","url":"https://www.linkedin.com/in/ada","image":{"contentUrl":"https://media.example/a.jpg"},"address":{"addressLocality":"London","addressCountry":"GB"},"worksFor":[{"name":"Lovelace Ltd","member":{"startDate":"2020-01"}}],"alumniOf":[{"name":"Cambridge","member":{"startDate":"2010","endDate":"2013"}}],"sameAs":["https://github.com/ada"]}]}</script></head></html>`;
    const person = extractJsonLd(html).find((o) => o["@type"] === "Person")!;
    const p = mapPersonLd(person);
    expect(ProviderProfile.parse(p)).toBeTruthy();
    expect(p.fullName).toBe("Ada Example");
    expect(p.location).toBe("London, GB");
    expect(p.experience?.[0]).toMatchObject({ company: "Lovelace Ltd", current: true });
    expect(p.education?.[0]).toMatchObject({ school: "Cambridge", end: { year: 2013 } });
    expect(p.links?.map((l) => l.network)).toEqual(["linkedin", "github"]);
  });
});
