import { describe, expect, it } from "vitest";
import { createMockPropertyConstraintsReport, createPropertyConstraintsReport } from "./property-constraints.js";

describe("createMockPropertyConstraintsReport", () => {
  it("returns the full report schema for a quick search", () => {
    const report = createMockPropertyConstraintsReport({
      clientName: "Jane Client",
      clientEmail: "jane@example.com",
      clientPhone: "020 0000 0000",
      propertyAddress: "1 Test Street",
      propertyPostcode: "W11 2BQ",
      searchDepth: "quick",
      projectTypes: ["House extension"],
    }, new Date("2026-07-03T09:00:00.000Z"));

    expect(report.client.client_name).toBe("Jane Client");
    expect(report.client.email).toBe("jane@example.com");
    expect(report.client.phone).toBe("020 0000 0000");
    expect(report.search.search_depth).toBe("quick");
    expect(report.search.overall_risk).toBe("red");
    expect(Object.keys(report.planning_heritage)).toHaveLength(8);
    expect(Object.keys(report.trees_ecology_landscape)).toHaveLength(13);
    expect(Object.keys(report.flood_ground_environment)).toHaveLength(8);
    expect(Object.keys(report.planning_potential)).toHaveLength(9);
    expect(Object.keys(report.access_highways_practical)).toHaveLength(8);
    expect(Object.keys(report.legal_ownership)).toHaveLength(4);
    expect(report.title_details.tenure).toBe("not_known");
    expect(report.title_details.title_numbers).toEqual([]);
    expect(report.title_details.confidence).toBe("manual_check_required");
    expect(report.source_links.length).toBeGreaterThan(0);
    expect(report.caveats).toHaveLength(2);
    expect(report.recommended_next_steps).toContain("Use an in-depth search before issuing fee proposal or pre-purchase advice.");
  });

  it("adds in-depth and project-specific next steps", () => {
    const report = createMockPropertyConstraintsReport({
      clientName: "Jane Client",
      propertyAddress: "Flat 2, 1 Test Street, London",
      propertyPostcode: "W11 2BQ",
      searchDepth: "in_depth",
      projectTypes: ["Basement", "Flat conversion"],
      proposedWorks: "New basement below existing house",
    }, new Date("2026-07-03T09:00:00.000Z"));

    expect(report.search.search_depth).toBe("in_depth");
    expect(report.recommended_next_steps).toContain("Review planning history, refusals, appeals, enforcement records and outstanding conditions.");
    expect(report.recommended_next_steps).toContain("Confirm whether basement policy, groundwater, sewer/build-over, flood risk, party wall and tunnel proximity constraints affect the feasibility strategy.");
    expect(report.recommended_next_steps).toContain("Confirm leasehold, freeholder, management company and covenant controls before planning the consent route.");
    expect(report.flood_ground_environment.surface_water_flood_risk.status).toBe("amber");
    expect(report.access_highways_practical.railway_tunnel_proximity.result).toBe("possible");
    expect(report.title_details.tenure).toBe("leasehold");
  });

  it("overlays live local authority and planning designation results", async () => {
    const report = await createPropertyConstraintsReport({
      clientName: "Jane Client",
      propertyAddress: "1 Test Street, London",
      propertyPostcode: "W11 2BQ",
      searchDepth: "quick",
      projectTypes: ["House extension"],
    }, {
      async resolveProperty(input) {
        expect(input.propertyPostcode).toBe("W11 2BQ");
        return {
          resolvedAddress: "1 Test Street, London W11 2BQ",
          uprn: null,
          latitude: 51.515591,
          longitude: -0.204155,
          postcode: "W11 2BQ",
          localAuthority: "Kensington and Chelsea",
          localAuthoritySourceNote: "Local authority detected from postcode district data.",
        };
      },
      async planningEntities() {
        return [
          {
            entity: 44012761,
            name: "Ladbroke",
            dataset: "conservation-area",
            reference: "3",
            quality: "authoritative",
          },
          {
            entity: 7010004867,
            name: "Article 4 - No 100",
            dataset: "article-4-direction-area",
            reference: "79",
            quality: "authoritative",
            permitted_development_rights: "Basements",
          },
          {
            entity: 19137680,
            dataset: "tree-preservation-zone",
            reference: "3",
            quality: "authoritative",
          },
          {
            entity: 626200,
            name: "Royal Borough of Kensington and Chelsea",
            dataset: "local-planning-authority",
            reference: "E09000020",
            quality: "authoritative",
          },
        ];
      },
    }, new Date("2026-07-03T09:00:00.000Z"));

    expect(report.property.local_authority).toBe("Royal Borough of Kensington and Chelsea");
    expect(report.property.postcode).toBe("W11 2BQ");
    expect(report.planning_heritage.conservation_area.name).toBe("Ladbroke Conservation Area");
    expect(report.planning_heritage.article_4_directions.result).toBe("yes");
    expect(report.trees_ecology_landscape.tree_preservation_orders.status).toBe("red");
    expect(report.source_links[0]?.label).toBe("Postcodes.io postcode lookup");
  });

  it("does not keep the mock local authority when live detection fails", async () => {
    const report = await createPropertyConstraintsReport({
      clientName: "Jane Client",
      propertyAddress: "1 Test Street",
      propertyPostcode: "W11 2BQ",
      searchDepth: "quick",
      projectTypes: ["House extension"],
    }, {
      async resolveProperty() {
        return {
          resolvedAddress: "1 Test Street",
          uprn: null,
          latitude: null,
          longitude: null,
          postcode: null,
          localAuthority: null,
          localAuthoritySourceNote: "No postcode was found in the address, so local authority detection needs manual confirmation.",
        };
      },
      async planningEntities() {
        return [];
      },
    }, new Date("2026-07-03T09:00:00.000Z"));

    expect(report.property.local_authority).toBeNull();
  });
});
