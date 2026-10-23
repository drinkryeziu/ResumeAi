import { describe, expect, it, vi } from "vitest";
import { cityStateOf, headerLines, resumeFromProfile } from "@/server/documents/model";
import { resumePlainText } from "@/server/documents/plain-text";
import { TEST_PROFILE } from "./fixtures";

vi.mock("server-only", () => ({}));

describe("the resume header", () => {
  const profile = { ...TEST_PROFILE, phone: "+1 929 354 3643", city: "Cornelius", state: "NC", country: "United States", links: { linkedin: "https://www.linkedin.com/in/ana", portfolio: "https://ana.example.com" } };

  it("puts city and state, not the country, on the place line", () => {
    expect(cityStateOf({ city: "Cornelius", state: "NC", country: "United States" })).toBe("Cornelius, NC");
    expect(cityStateOf({ city: "Berlin", state: null, country: "Germany" })).toBe("Berlin, Germany");
    expect(cityStateOf({ city: null, state: null, country: "Germany" })).toBe("Germany");
    expect(cityStateOf({ city: "Cornelius", state: null, country: null })).toBe("Cornelius");
    expect(cityStateOf({ city: null, state: null, country: null })).toBeNull();
  });

  it("is one fact per line: name, job title, phone and email, city and state, then the links", () => {
    const doc = resumeFromProfile(profile);
    const head = headerLines(doc.header);
    expect(head.name).toBe("Alex Rivera");
    expect(head.contact).toBe("+1 929 354 3643  |  alex.rivera@example.com");
    expect(head.place).toBe("Cornelius, NC");
    expect(head.links.map((l) => l.text)).toEqual(["linkedin.com/in/ana", "ana.example.com"]);
  });

  it("leaves out a line it has nothing for", () => {
    const head = headerLines(resumeFromProfile({ ...profile, phone: null, city: null, state: null, country: null, links: {} }).header);
    expect(head.contact).toBe("alex.rivera@example.com");
    expect(head.place).toBe("");
    expect(head.links).toEqual([]);
  });

  it("is copied as text in the same order, line by line", () => {
    const text = resumePlainText(resumeFromProfile(profile));
    const top = text.split("\n").slice(0, 5);
    expect(top[0]).toBe("Alex Rivera");
    expect(top[1]).toBe(resumeFromProfile(profile).header.headline);
    expect(top[2]).toBe("+1 929 354 3643  |  alex.rivera@example.com");
    expect(top[3]).toBe("Cornelius, NC");
    expect(top[4]).toBe("linkedin.com/in/ana  |  ana.example.com");
  });
});
