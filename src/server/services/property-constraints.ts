import type { ConstraintCheck, ConstraintStatus, PropertyConstraintsReport, PropertyConstraintsSearchInput } from "../../shared/property-constraints.js";

const TOOL_VERSION = "live-planning-mvp-1";
const NOTTING_HILL_LATITUDE = 51.5116;
const NOTTING_HILL_LONGITUDE = -0.2054;
const DEFAULT_POSTCODE = "W11 2BQ";
const DEFAULT_LOCAL_AUTHORITY = "Royal Borough of Kensington and Chelsea";
const POSTCODES_IO_BASE_URL = "https://api.postcodes.io/postcodes";
const PLANNING_DATA_ENTITY_URL = "https://www.planning.data.gov.uk/entity.json";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

interface ResolvedPropertyContext {
  resolvedAddress: string | null;
  uprn: string | null;
  latitude: number | null;
  longitude: number | null;
  postcode: string | null;
  localAuthority: string | null;
  localAuthoritySourceNote?: string;
}

interface LivePropertyData {
  property: ResolvedPropertyContext;
  planningEntities: PlanningEntity[];
}

interface PropertyConstraintsLiveDataClient {
  resolveProperty(input: PropertyConstraintsSearchInput): Promise<ResolvedPropertyContext>;
  planningEntities(latitude: number, longitude: number): Promise<PlanningEntity[]>;
}

interface PostcodesIoResponse {
  status: number;
  result?: {
    postcode?: string;
    longitude?: number;
    latitude?: number;
    admin_district?: string;
  } | null;
}

interface PlanningEntity {
  entity: number;
  name?: string;
  dataset?: string;
  reference?: string;
  quality?: string;
  article_4_direction?: string;
  permitted_development_rights?: string;
  listed_building_grade?: string;
}

interface PlanningDataResponse {
  entities?: PlanningEntity[];
  count?: number;
}

interface NominatimSearchResult {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function createPropertyConstraintsReport(
  input: PropertyConstraintsSearchInput,
  client: PropertyConstraintsLiveDataClient = livePropertyDataClient,
  searchedAt = new Date(),
): Promise<PropertyConstraintsReport> {
  const liveData = await livePropertyData(input, client);
  return applyLivePropertyData(createMockPropertyConstraintsReport(input, searchedAt), liveData);
}

async function livePropertyData(input: PropertyConstraintsSearchInput, client: PropertyConstraintsLiveDataClient): Promise<LivePropertyData> {
  const property = await client.resolveProperty(input);
  const planningEntities = property.latitude !== null && property.longitude !== null
    ? await client.planningEntities(property.latitude, property.longitude)
    : [];
  return { property, planningEntities };
}

const livePropertyDataClient: PropertyConstraintsLiveDataClient = {
  async resolveProperty(input) {
    const postcode = postcodeFromInput(input);
    if (!postcode) {
      const addressLookup = await addressLookupResult(input.propertyAddress);
      return {
        resolvedAddress: (addressLookup?.display_name ?? input.propertyAddress.trim()) || null,
        uprn: null,
        latitude: numberStringOrNull(addressLookup?.lat),
        longitude: numberStringOrNull(addressLookup?.lon),
        postcode: null,
        localAuthority: trimmedOrUndefined(input.knownLocalAuthority) ?? null,
        localAuthoritySourceNote: "No confirmed postcode was found, so postcode-based local authority detection needs manual confirmation.",
      };
    }

    const response = await fetch(`${POSTCODES_IO_BASE_URL}/${encodeURIComponent(postcode)}`);
    if (!response.ok) {
      return {
        resolvedAddress: input.propertyAddress.trim() || null,
        uprn: null,
        latitude: null,
        longitude: null,
        postcode,
        localAuthority: trimmedOrUndefined(input.knownLocalAuthority) ?? null,
        localAuthoritySourceNote: "Postcode lookup failed, so local authority detection needs manual confirmation.",
      };
    }

    const body = postcodesIoResponse(await response.json());
    const result = body.result;
    return {
      resolvedAddress: input.propertyAddress.trim() || result?.postcode || null,
      uprn: null,
      latitude: numberOrNull(result?.latitude),
      longitude: numberOrNull(result?.longitude),
      postcode: result?.postcode ?? postcode,
      localAuthority: trimmedOrUndefined(input.knownLocalAuthority) ?? result?.admin_district ?? null,
      localAuthoritySourceNote: trimmedOrUndefined(input.knownLocalAuthority)
        ? "Local authority was provided manually."
        : "Local authority detected from postcode district data.",
    };
  },
  async planningEntities(latitude, longitude) {
    const url = new URL(PLANNING_DATA_ENTITY_URL);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    for (const dataset of [
      "conservation-area",
      "listed-building",
      "green-belt",
      "flood-risk-zone",
      "article-4-direction-area",
      "tree-preservation-zone",
      "local-planning-authority",
    ]) {
      url.searchParams.append("dataset", dataset);
    }
    for (const field of [
      "dataset",
      "name",
      "reference",
      "entity",
      "quality",
      "article-4-direction",
      "permitted-development-rights",
      "listed-building-grade",
    ]) {
      url.searchParams.append("field", field);
    }
    url.searchParams.set("limit", "100");

    const response = await fetch(url);
    if (!response.ok) return [];
    return planningDataResponse(await response.json()).entities ?? [];
  },
};

export function createMockPropertyConstraintsReport(input: PropertyConstraintsSearchInput, searchedAt = new Date()): PropertyConstraintsReport {
  const localAuthority = input.knownLocalAuthority?.trim() || DEFAULT_LOCAL_AUTHORITY;
  const projectTypes = input.projectTypes;
  const isBasement = projectTypes.includes("Basement") || textIncludes(input.proposedWorks, "basement");
  const isLoft = projectTypes.includes("Loft conversion") || textIncludes(input.proposedWorks, "loft") || textIncludes(input.proposedWorks, "roof");
  const isFlat = projectTypes.includes("Flat conversion") || textIncludes(input.propertyAddress, "flat");
  const isNewDwellingOrChange = projectTypes.includes("New dwelling") || projectTypes.includes("Change of use");
  const isInDepth = input.searchDepth === "in_depth";

  const planningHeritage: Record<string, ConstraintCheck> = {
    conservation_area: redCheck(
      "Ladbroke Conservation Area",
      "Studio McLeod mock planning dataset",
      "https://www.rbkc.gov.uk/planning-and-building-control/conservation-and-heritage/conservation-areas",
      "The property appears to be within a conservation area. External alterations, demolition, roof changes, window changes, boundary works and tree works may be more sensitive.",
      "Mock data selected for MVP testing. Verify against the borough conservation area map before formal advice.",
      "RBKC-CA-Ladbroke",
    ),
    article_4_directions: amberManualCheck(
      "Article 4 Directions",
      "RBKC Article 4 guidance",
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-applications/article-4-directions",
      "An Article 4 Direction may restrict permitted development rights. Planning permission may be required for works that would otherwise be permitted development.",
      "Not found in national dataset. Local authority check required.",
    ),
    listed_building: greenNotFound(
      "Historic England NHLE",
      "https://historicengland.org.uk/listing/the-list/",
      "No national listed-building record was found in the checked source. Verify with Historic England / NHLE before formal advice.",
    ),
    locally_listed_building: greyManualCheck(
      "Local list",
      "RBKC local list",
      "https://www.rbkc.gov.uk/planning-and-building-control/conservation-and-heritage",
      "Local listing or non-designated heritage asset status should be checked against the local authority planning map or local list.",
    ),
    archaeological_priority_area: amberPossible(
      "Archaeological priority area",
      "Historic England heritage gateway",
      "https://www.heritagegateway.org.uk/gateway/",
      "The property may be within an archaeological priority area. Groundworks, basements or new foundations may require archaeological assessment or watching brief.",
      "Manual verification is required because archaeological priority areas are often held by the borough.",
    ),
    world_heritage_site_buffer: greenNotFound(
      "UNESCO and Historic England",
      "https://historicengland.org.uk/advice/planning/international-designations/world-heritage-sites/",
      "No World Heritage Site or buffer zone was found in the checked mock dataset.",
    ),
    registered_park_and_garden: greenNotFound(
      "Historic England registered parks and gardens",
      "https://historicengland.org.uk/listing/the-list/",
      "No registered park or garden was found in the checked mock dataset.",
    ),
    scheduled_monument: greenNotFound(
      "Historic England scheduled monuments",
      "https://historicengland.org.uk/listing/the-list/",
      "No scheduled monument was found in the checked mock dataset.",
    ),
  };

  const treesEcologyLandscape: Record<string, ConstraintCheck> = {
    tree_preservation_orders: amberManualCheck(
      "Tree Preservation Orders",
      "Local authority tree map",
      "https://www.rbkc.gov.uk/planning-and-building-control/trees-and-hedges",
      "One or more Tree Preservation Orders may affect the site. Do not assume trees can be removed, pruned or affected by foundations without consent.",
      "TPOs should be checked against the local authority tree map before relying on this result.",
    ),
    trees_in_conservation_area: {
      status: "amber",
      result: "possible",
      name: "Trees in conservation area",
      distance_m: null,
      source: "Derived from conservation area result",
      source_url: "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
      confidence: "high",
      architect_note: "Because the property is in a conservation area, works to trees may require six weeks' notice to the local authority, even where no TPO is identified.",
      verification_note: "Confirm whether any proposed works affect trees, roots or canopies.",
      raw_reference: "derived:conservation_area",
    },
    ancient_woodland: greenNotFound(
      "Natural England ancient woodland inventory",
      "https://magic.defra.gov.uk/",
      "No ancient woodland was found on or near the site in the checked mock dataset.",
    ),
    sssi: greenNotFound(
      "Natural England SSSI data",
      "https://magic.defra.gov.uk/",
      "No SSSI overlap was found in the checked mock dataset. Nearby ecological designations should still be verified for larger projects.",
    ),
    sac: greenNotFound(
      "Natural England SAC data",
      "https://magic.defra.gov.uk/",
      "No Special Area of Conservation overlap was found in the checked mock dataset.",
    ),
    spa: greenNotFound(
      "Natural England SPA data",
      "https://magic.defra.gov.uk/",
      "No Special Protection Area overlap was found in the checked mock dataset.",
    ),
    ramsar: greenNotFound(
      "Natural England Ramsar data",
      "https://magic.defra.gov.uk/",
      "No Ramsar site overlap was found in the checked mock dataset.",
    ),
    priority_habitats: amberPossible(
      "Priority habitats",
      "MAGIC priority habitat inventory",
      "https://magic.defra.gov.uk/",
      "Priority habitat may be present on or near the site. This may affect Biodiversity Net Gain, ecology surveys and landscape strategy.",
      "Mock data marks this as a proximity prompt rather than a confirmed site overlap.",
    ),
    biodiversity_net_gain: amberManualCheck(
      "Biodiversity Net Gain",
      "GOV.UK BNG guidance",
      "https://www.gov.uk/guidance/understanding-biodiversity-net-gain",
      projectTypes.includes("House extension") || projectTypes.includes("Loft conversion")
        ? "Biodiversity Net Gain may be exempt or unlikely to be significant for small domestic alterations, but confirm once the project scope is known."
        : "Biodiversity Net Gain should be considered. Applicability depends on project type, exemptions, site area and development description.",
      "Do not treat this as a final legal answer. Confirm against the project description, site area and current exemptions.",
    ),
    national_landscape: greenNotFound(
      "Natural England National Landscapes",
      "https://magic.defra.gov.uk/",
      "No National Landscape designation was found in the checked mock dataset.",
    ),
    national_park: greenNotFound(
      "National Parks England",
      "https://www.nationalparks.uk/",
      "No National Park designation was found in the checked mock dataset.",
    ),
    green_belt: greenNotFound(
      "Local planning policy map",
      "https://www.planning.data.gov.uk/",
      "No Green Belt designation was found in the checked mock dataset.",
    ),
    metropolitan_open_land: amberManualCheck(
      "Metropolitan Open Land",
      "London Datastore and borough policy map",
      "https://data.london.gov.uk/",
      "Metropolitan Open Land should be checked against local planning policy, especially for London sites.",
      "London-specific policy layers should be verified against the borough policies map.",
    ),
  };

  const floodGroundEnvironment: Record<string, ConstraintCheck> = {
    flood_zone_2_3: greenNo(
      "Flood Zone 1",
      "Environment Agency flood map",
      "https://check-long-term-flood-risk.service.gov.uk/map",
      "The property appears to be in Flood Zone 1 based on the checked mock source.",
      "Confirm with the Environment Agency flood map before formal advice.",
    ),
    surface_water_flood_risk: isBasement
      ? amberPossible(
          "Medium surface water flood risk",
          "Environment Agency surface water flood risk",
          "https://check-long-term-flood-risk.service.gov.uk/map",
          "Surface water flood risk may affect drainage strategy, external levels, thresholds, basements and SuDS requirements.",
          "Basement projects should treat surface water risk as a design and survey prompt.",
        )
      : greenNo(
          "Very low surface water flood risk",
          "Environment Agency surface water flood risk",
          "https://check-long-term-flood-risk.service.gov.uk/map",
          "Surface water flood risk is shown as very low in the checked mock source.",
          "Confirm with the Environment Agency long-term flood risk map.",
        ),
    critical_drainage_area: amberManualCheck(
      "Critical drainage area",
      "Local flood authority",
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy",
      "Critical drainage area status should be checked against local authority mapping and local flood authority guidance.",
      "National open data does not provide a reliable complete result for this check.",
    ),
    groundwater_flood_risk: isBasement
      ? amberPossible(
          "Groundwater flood risk",
          "BGS groundwater indicators",
          "https://www.bgs.ac.uk/datasets/groundwater-flooding/",
          "Groundwater risk may affect basements, lower-ground extensions, drainage design and site investigation requirements.",
          "Basement proposals should include a site-specific groundwater review.",
        )
      : greyManualCheck(
          "Groundwater flood risk",
          "BGS groundwater indicators",
          "https://www.bgs.ac.uk/datasets/groundwater-flooding/",
          "Groundwater risk may affect basements, lower-ground extensions, drainage design and site investigation requirements.",
        ),
    contaminated_land: amberManualCheck(
      "Contaminated land",
      "Local authority environmental health",
      "https://www.rbkc.gov.uk/environment/environmental-health",
      "Contaminated land risk should be checked if the site has former industrial, commercial, garage, workshop, railway or infill history.",
      "Review historic mapping and local authority records where groundworks or change of use are proposed.",
    ),
    radon: greenNo(
      "Low radon potential",
      "UKradon",
      "https://www.ukradon.org/information/ukmaps",
      "Radon potential is low in the checked mock dataset. Confirm if the project involves significant groundworks or new habitable lower-ground accommodation.",
      "A paid address-level radon report may still be required for conveyancing or detailed technical advice.",
    ),
    air_quality_management_area: amberPossible(
      "Air Quality Management Area",
      "Local authority AQMA records",
      "https://uk-air.defra.gov.uk/aqma/",
      "The property appears to be within an Air Quality Management Area. Ventilation strategy, plant, traffic impact or residential development may require additional consideration.",
      "Mock data flags a London borough-wide AQMA. Confirm the current local designation.",
    ),
    noise_constraints: amberPossible(
      "Urban road and rail noise",
      "DEFRA noise mapping and local review",
      "https://www.gov.uk/government/publications/noise-mapping-england",
      "Noise constraints should be reviewed manually using mapping, site visit and project type. Acoustic advice may be required for new residential units or sensitive uses.",
      "Use site visit, local context and project type before deciding whether acoustic advice is needed.",
    ),
  };

  const planningPotential: Record<string, ConstraintCheck> = {
    planning_history: greyManualCheck(
      "Planning history",
      `${localAuthority} planning search`,
      "https://www.rbkc.gov.uk/planning/searches",
      "Review previous applications, refusals, appeals, lawful development certificates and conditions before advising on planning risk.",
    ),
    enforcement_history: greyManualCheck(
      "Enforcement history",
      `${localAuthority} planning enforcement`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-enforcement",
      "Check whether the property has any enforcement notices, breaches or unresolved planning issues.",
    ),
    outstanding_conditions: greyManualCheck(
      "Outstanding conditions",
      `${localAuthority} planning search`,
      "https://www.rbkc.gov.uk/planning/searches",
      "Outstanding or undischarged planning conditions may affect whether works can lawfully start or whether previous permissions remain usable.",
    ),
    brownfield_register: greenNotFound(
      "Brownfield register",
      "https://www.planning.data.gov.uk/dataset/brownfield-land",
      "The property was not found on the checked mock brownfield register data.",
    ),
    local_plan_allocation: amberManualCheck(
      "Local Plan allocation",
      `${localAuthority} policies map`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy",
      "Check whether the site is allocated for housing, employment, mixed use, open space, infrastructure or other policy purpose.",
      "This MVP includes a manual policy-map prompt only.",
    ),
    town_centre_boundary: greenNamedNotFound(
      "Town centre boundary",
      `${localAuthority} policies map`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy",
      "No town centre boundary was found in the checked mock dataset.",
    ),
    employment_land: greenNamedNotFound(
      "Employment land",
      `${localAuthority} policies map`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy",
      "No employment land designation was found in the checked mock dataset.",
    ),
    cil_charging_zone: amberManualCheck(
      "CIL charging zone",
      `${localAuthority} CIL charging schedule`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy/community-infrastructure-levy",
      "CIL liability and charging zone should be checked before giving client cost advice. Mayoral CIL may apply.",
      "London-specific CIL should be verified against borough and Mayoral charging schedules.",
    ),
    spd_design_code_area: amberManualCheck(
      "SPD / design code area",
      `${localAuthority} supplementary planning documents`,
      "https://www.rbkc.gov.uk/planning-and-building-control/planning-policy",
      "Check local SPDs, conservation area appraisals, design codes, basement policies and householder guidance before developing the design.",
      "This London mock report should trigger a borough guidance review.",
    ),
  };

  const accessHighwaysPractical: Record<string, ConstraintCheck> = {
    adopted_highway: greyManualCheck(
      "Adopted highway",
      "Local highway authority",
      "https://www.rbkc.gov.uk/parking-transport-and-streets",
      "Adopted highway extent should be checked for crossovers, boundary walls, vaults, scaffolding, pavement licences and works near the street.",
    ),
    public_right_of_way: greenNamedNotFound(
      "Public right of way",
      "Local highway authority",
      "https://www.rbkc.gov.uk/parking-transport-and-streets",
      "No public right of way was found in the checked mock dataset. Confirm against local highway records for formal advice.",
    ),
    red_route_tfl_road: amberPossible(
      "TfL red route proximity",
      "TfL red routes",
      "https://tfl.gov.uk/modes/driving/red-routes",
      "Red route or TfL road status may affect access, deliveries, scaffolding, crossovers and construction logistics.",
      "Mock result flags London proximity. Check whether the property frontage is directly affected.",
    ),
    cpz_parking_stress: amberManualCheck(
      "CPZ / parking stress",
      "Local parking controls",
      "https://www.rbkc.gov.uk/parking-transport-and-streets/parking",
      "Controlled parking and parking stress should be checked for new dwellings, conversions, car-free development and construction logistics.",
      "London borough parking policy should be checked before advising on access or car-free development.",
    ),
    crossover_restrictions: greyManualCheck(
      "Crossover restrictions",
      "Local highway authority",
      "https://www.rbkc.gov.uk/parking-transport-and-streets",
      "Vehicle crossover feasibility should be checked against local highway policy, trees, parking bays, street furniture and visibility.",
    ),
    ptal_public_transport_accessibility: amberPossible(
      "PTAL",
      "TfL WebCAT",
      "https://tfl.gov.uk/info-for/urban-planning-and-construction/planning-with-webcat/webcat",
      "PTAL may affect planning arguments for car-free development, density, cycle parking and transport statements.",
      "This property appears to be in Greater London. Check the address in TfL WebCAT.",
    ),
    sewer_build_over_risk: amberManualCheck(
      "Sewer/build-over risk",
      "Thames Water build-over guidance",
      "https://www.thameswater.co.uk/developers/larger-scale-developments/planning-your-development/building-over-or-near-a-sewer",
      "Sewer location and build-over requirements should be checked before fixing foundations, basements, extensions or garden buildings.",
      "Order or review drainage records before foundation strategy is fixed.",
    ),
    railway_tunnel_proximity: isBasement
      ? amberPossible(
          "Railway/tunnel proximity",
          "TfL and Network Rail asset protection",
          "https://tfl.gov.uk/info-for/urban-planning-and-construction/urban-planning-and-construction-contacts",
          "Nearby railway, underground or tunnel infrastructure may affect basements, foundations, party wall matters, approvals and construction methodology.",
          "Basement proposals should verify tunnel proximity early.",
        )
      : greyManualCheck(
          "Railway/tunnel proximity",
          "TfL and Network Rail asset protection",
          "https://tfl.gov.uk/info-for/urban-planning-and-construction/urban-planning-and-construction-contacts",
          "Nearby railway, underground or tunnel infrastructure may affect basements, foundations, party wall matters, approvals and construction methodology.",
        ),
  };

  const legalOwnership: Record<string, ConstraintCheck> = {
    title_boundary: greyManualCheck(
      "Title boundary",
      "HM Land Registry",
      "https://www.gov.uk/search-property-information-land-registry",
      "Title boundaries should be checked against Land Registry title plans before relying on site ownership, garden extent, access or boundary assumptions.",
    ),
    leasehold_freehold_flag: greyManualCheck(
      "Leasehold/freehold flag",
      "HM Land Registry",
      "https://www.gov.uk/search-property-information-land-registry",
      "Freehold/leasehold status should be confirmed. Flats, maisonettes and leasehold houses may require landlord/freeholder consent in addition to planning consent.",
    ),
    restrictive_covenant_reminder: greyManualCheck(
      "Restrictive covenant reminder",
      "Client solicitor or title review",
      "https://www.gov.uk/search-property-information-land-registry",
      "Restrictive covenants may limit alterations, extensions, use, windows, materials, boundaries or development even where planning permission is available. Client should seek legal advice.",
    ),
    asset_of_community_value: greenNamedNotFound(
      "Asset of Community Value",
      `${localAuthority} ACV register`,
      "https://www.rbkc.gov.uk/business-and-enterprise/community-right-bid",
      "No Asset of Community Value status was found in the checked mock dataset.",
    ),
  };

  const titleDetails = {
    tenure: isFlat ? "leasehold" : "not_known",
    title_numbers: [],
    lease: isFlat ? {
      term: null,
      start_date: null,
      end_date: null,
    } : undefined,
    proprietor: {
      type: "unknown",
      name: null,
    },
    confidence: "manual_check_required",
    source: "Mock title data",
    notes: "Title details are a placeholder until a Land Registry-backed provider is connected. Treat tenure, title numbers, lease particulars and proprietor details as requiring verification.",
  } satisfies PropertyConstraintsReport["title_details"];

  const recommendedNextSteps = [
    "Verify conservation area, Article 4, local list and TPO results against the borough planning map before formal advice.",
    "Check whether any tree works require six weeks' notice.",
    "Check whether permitted development rights are restricted.",
    "Check borough-specific planning guidance, conservation area appraisals, basement policy, CIL charging schedules and parking policy.",
    ...(isInDepth ? [
      "Review planning history, refusals, appeals, enforcement records and outstanding conditions.",
      "Review Land Registry title, tenure, rights, covenants and title plan before relying on boundaries or ownership assumptions.",
    ] : [
      "Use an in-depth search before issuing fee proposal or pre-purchase advice.",
    ]),
    ...(isBasement ? [
      "Confirm whether basement policy, groundwater, sewer/build-over, flood risk, party wall and tunnel proximity constraints affect the feasibility strategy.",
    ] : []),
    ...(isLoft ? [
      "Escalate roofscape, bat/ecology, conservation area and Article 4 checks before advising on consent route.",
    ] : []),
    ...(isFlat ? [
      "Confirm leasehold, freeholder, management company and covenant controls before planning the consent route.",
    ] : []),
    ...(isNewDwellingOrChange ? [
      "Check CIL, BNG, parking, PTAL, space standards, planning history and local plan allocation before fee proposal advice.",
    ] : []),
  ];

  const report = {
    client: {
      client_name: input.clientName.trim(),
      email: trimmedOrUndefined(input.clientEmail),
      phone: trimmedOrUndefined(input.clientPhone),
      project_reference: trimmedOrUndefined(input.projectReference),
    },
    property: {
      input_address: input.propertyAddress.trim(),
      resolved_address: mockResolvedAddress(input.propertyAddress),
      uprn: "100023336956",
      latitude: NOTTING_HILL_LATITUDE,
      longitude: NOTTING_HILL_LONGITUDE,
      postcode: DEFAULT_POSTCODE,
      local_authority: localAuthority,
    },
    search: {
      search_date: searchedAt.toISOString(),
      search_depth: input.searchDepth,
      tool_version: TOOL_VERSION,
      overall_risk: overallRisk([
        planningHeritage,
        treesEcologyLandscape,
        floodGroundEnvironment,
        planningPotential,
        accessHighwaysPractical,
        legalOwnership,
      ]),
    },
    planning_heritage: planningHeritage,
    trees_ecology_landscape: treesEcologyLandscape,
    flood_ground_environment: floodGroundEnvironment,
    planning_potential: planningPotential,
    access_highways_practical: accessHighwaysPractical,
    legal_ownership: legalOwnership,
    title_details: titleDetails,
    source_links: [
      { label: "Local authority planning search", url: "https://www.rbkc.gov.uk/planning/searches", notes: "Manual planning history, enforcement and conditions check." },
      { label: "Local authority conservation and heritage", url: "https://www.rbkc.gov.uk/planning-and-building-control/conservation-and-heritage", notes: "Conservation area, local list and Article 4 verification." },
      { label: "Historic England NHLE", url: "https://historicengland.org.uk/listing/the-list/", notes: "Listed buildings, scheduled monuments, registered parks and gardens." },
      { label: "Environment Agency flood map", url: "https://check-long-term-flood-risk.service.gov.uk/map", notes: "Flood zone and surface water review." },
      { label: "MAGIC map", url: "https://magic.defra.gov.uk/", notes: "Ecology, landscape and habitat designations." },
      { label: "TfL WebCAT", url: "https://tfl.gov.uk/info-for/urban-planning-and-construction/planning-with-webcat/webcat", notes: "PTAL and London transport accessibility." },
      { label: "HM Land Registry title search", url: "https://www.gov.uk/search-property-information-land-registry", notes: "Title, tenure, boundaries and covenant prompt." },
    ],
    recommended_next_steps: recommendedNextSteps,
    caveats: [
      "This automated search checks national and available open planning/environmental datasets. Some datasets, particularly Article 4 Directions, Tree Preservation Orders, locally listed buildings, planning history, enforcement history, CIL zones, design codes and adopted highway records, may be incomplete or only available from the local planning authority.",
      "This report is intended as an initial architectural constraints check only. It is not a legal certificate, title review, consultant report or formal planning opinion. Before issuing formal advice, Studio McLeod should verify relevant findings against the local authority, Historic England/NHLE, Environment Agency data, title documents and any required specialist consultant input.",
    ],
  } satisfies PropertyConstraintsReport;

  return report;
}

function applyLivePropertyData(report: PropertyConstraintsReport, liveData: LivePropertyData): PropertyConstraintsReport {
  const liveLocalAuthority = liveLocalAuthorityName(liveData);
  const liveReport: PropertyConstraintsReport = {
    ...report,
    property: {
      ...report.property,
      resolved_address: liveData.property.resolvedAddress ?? report.property.resolved_address,
      uprn: liveData.property.uprn,
      latitude: liveData.property.latitude ?? report.property.latitude,
      longitude: liveData.property.longitude ?? report.property.longitude,
      postcode: liveData.property.postcode ?? report.property.postcode,
      local_authority: liveLocalAuthority,
    },
    planning_heritage: {
      ...report.planning_heritage,
      conservation_area: liveConservationAreaCheck(liveData.planningEntities),
      article_4_directions: liveArticle4Check(liveData.planningEntities),
      listed_building: liveListedBuildingCheck(liveData.planningEntities),
    },
    trees_ecology_landscape: {
      ...report.trees_ecology_landscape,
      tree_preservation_orders: liveTreePreservationCheck(liveData.planningEntities),
      trees_in_conservation_area: liveTreesInConservationAreaCheck(liveData.planningEntities),
      green_belt: liveGreenBeltCheck(liveData.planningEntities),
    },
    flood_ground_environment: {
      ...report.flood_ground_environment,
      flood_zone_2_3: liveFloodRiskZoneCheck(liveData.planningEntities),
    },
    source_links: [
      { label: "Postcodes.io postcode lookup", url: "https://api.postcodes.io/", notes: liveData.property.localAuthoritySourceNote },
      { label: "Planning Data point query", url: planningDataMapUrl(liveData.property), notes: "Live point-in-designation checks for local planning authority, conservation area, Article 4, listed building, Green Belt, flood risk zone and TPO layers." },
      ...report.source_links,
    ],
  };
  return {
    ...liveReport,
    search: {
      ...liveReport.search,
      overall_risk: overallRisk([
        liveReport.planning_heritage,
        liveReport.trees_ecology_landscape,
        liveReport.flood_ground_environment,
        liveReport.planning_potential,
        liveReport.access_highways_practical,
        liveReport.legal_ownership,
      ]),
    },
  };
}

function liveLocalAuthorityName(liveData: LivePropertyData): string | null {
  const planningAuthority = firstEntityForDataset(liveData.planningEntities, "local-planning-authority");
  return planningAuthority?.name || liveData.property.localAuthority;
}

function liveConservationAreaCheck(entities: PlanningEntity[]): ConstraintCheck {
  const entity = firstEntityForDataset(entities, "conservation-area");
  if (!entity) {
    return greenNamedNotFound(
      "Conservation area",
      "Planning Data conservation area",
      "https://www.planning.data.gov.uk/dataset/conservation-area",
      "No conservation area was found in the live Planning Data point check. Local authority verification is recommended before formal advice.",
    );
  }
  return redCheck(
    entity.name ? `${entity.name} Conservation Area` : "Conservation area",
    "Planning Data conservation area",
    entityUrl(entity),
    "The property appears to be within a conservation area. External alterations, demolition, roof changes, window changes, boundary works and tree works may be more sensitive.",
    `Live Planning Data result. Quality: ${entity.quality ?? "not stated"}. Verify against the local authority map before formal advice.`,
    referenceForEntity(entity),
  );
}

function liveArticle4Check(entities: PlanningEntity[]): ConstraintCheck {
  const matches = entitiesForDataset(entities, "article-4-direction-area");
  if (!matches.length) {
    return amberManualCheck(
      "Article 4 Directions",
      "Planning Data Article 4 direction area",
      "https://www.planning.data.gov.uk/dataset/article-4-direction-area",
      "No Article 4 Direction was found in the live Planning Data point check, but Article 4 data can be incomplete and should be verified locally.",
      "Do not report a confident no until the local authority source has also been checked.",
    );
  }
  return redCheck(
    matches.map(article4EntityName).join(", "),
    "Planning Data Article 4 direction area",
    entityUrl(matches[0]),
    "An Article 4 Direction may restrict permitted development rights. Planning permission may be required for works that would otherwise be permitted development.",
    "Live Planning Data found one or more Article 4 direction areas. Check the local authority direction text before advising on permitted development.",
    matches.map(referenceForEntity).join(", "),
  );
}

function liveListedBuildingCheck(entities: PlanningEntity[]): ConstraintCheck {
  const entity = firstEntityForDataset(entities, "listed-building");
  if (!entity) {
    return greenNamedNotFound(
      "Listed building",
      "Planning Data listed building",
      "https://www.planning.data.gov.uk/dataset/listed-building",
      "No listed-building record was found in the live Planning Data point check. Verify with Historic England / NHLE before formal advice.",
    );
  }
  return redCheck(
    [entity.name || "Listed building", entity.listed_building_grade].filter(Boolean).join(" - "),
    "Planning Data listed building",
    entityUrl(entity),
    "The property appears to be listed. Listed Building Consent is likely to be required for works affecting the character of the building.",
    "Live Planning Data found a listed building at this point. Verify against Historic England / NHLE before formal advice.",
    referenceForEntity(entity),
  );
}

function liveTreePreservationCheck(entities: PlanningEntity[]): ConstraintCheck {
  const matches = entitiesForDataset(entities, "tree-preservation-zone");
  if (!matches.length) {
    return amberManualCheck(
      "Tree Preservation Orders",
      "Planning Data tree preservation zone",
      "https://www.planning.data.gov.uk/dataset/tree-preservation-zone",
      "No TPO zone was found in the live Planning Data point check, but TPO records should still be checked against the local authority tree map.",
      "TPO data coverage varies by local authority. Verify locally before relying on this result.",
    );
  }
  return redCheck(
    matches.map((entity) => entity.name || `Tree preservation zone ${entity.reference ?? entity.entity}`).join(", "),
    "Planning Data tree preservation zone",
    entityUrl(matches[0]),
    "One or more Tree Preservation Orders may affect the site. Do not assume trees can be removed, pruned or affected by foundations without consent.",
    "Live Planning Data found a tree preservation zone at this point. Confirm affected trees and order text with the local authority.",
    matches.map(referenceForEntity).join(", "),
  );
}

function liveTreesInConservationAreaCheck(entities: PlanningEntity[]): ConstraintCheck {
  const conservationArea = firstEntityForDataset(entities, "conservation-area");
  if (!conservationArea) {
    return {
      status: "green",
      result: "not_applicable",
      name: "Trees in conservation area",
      distance_m: null,
      source: "Derived from live conservation area result",
      source_url: "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
      confidence: "medium",
      architect_note: "The tree-in-conservation-area rule is not triggered by the live conservation area result.",
      verification_note: "Local authority verification is still recommended before formal advice.",
      raw_reference: null,
    };
  }
  return {
    status: "amber",
    result: "possible",
    name: "Trees in conservation area",
    distance_m: null,
    source: "Derived from live conservation area result",
    source_url: "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
    confidence: "high",
    architect_note: "Because the property is in a conservation area, works to trees may require six weeks' notice to the local authority, even where no TPO is identified.",
    verification_note: "Confirm whether any proposed works affect trees, roots or canopies.",
    raw_reference: referenceForEntity(conservationArea),
  };
}

function liveGreenBeltCheck(entities: PlanningEntity[]): ConstraintCheck {
  const entity = firstEntityForDataset(entities, "green-belt");
  if (!entity) {
    return greenNamedNotFound(
      "Green Belt",
      "Planning Data Green Belt",
      "https://www.planning.data.gov.uk/dataset/green-belt",
      "No Green Belt designation was found in the live Planning Data point check.",
    );
  }
  return redCheck(
    entity.name || "Green Belt",
    "Planning Data Green Belt",
    entityUrl(entity),
    "The property lies within Green Belt. Extensions, outbuildings, replacement dwellings and new development may be significantly constrained.",
    "Live Planning Data found Green Belt at this point. Verify against the local plan policies map.",
    referenceForEntity(entity),
  );
}

function liveFloodRiskZoneCheck(entities: PlanningEntity[]): ConstraintCheck {
  const entity = firstEntityForDataset(entities, "flood-risk-zone");
  if (!entity) {
    return greenNo(
      "Flood Zone 1",
      "Planning Data flood risk zone",
      "https://www.planning.data.gov.uk/dataset/flood-risk-zone",
      "No Flood Zone 2 or 3 designation was found in the live Planning Data point check.",
      "Confirm with Environment Agency flood mapping before formal advice.",
    );
  }
  const name = entity.name || `Flood risk zone ${entity.reference ?? entity.entity}`;
  const status = name.includes("3") ? "red" : "amber";
  return {
    status,
    result: "yes",
    name,
    distance_m: 0,
    source: "Planning Data flood risk zone",
    source_url: entityUrl(entity),
    confidence: "medium",
    architect_note: status === "red"
      ? "The property appears to be in Flood Zone 3. Flood Risk Assessment and drainage strategy are likely to be required."
      : "The property appears to be in Flood Zone 2. A Flood Risk Assessment may be required depending on the proposed works.",
    verification_note: "Live Planning Data found a flood risk zone at this point. Confirm with Environment Agency flood mapping before formal advice.",
    raw_reference: referenceForEntity(entity),
  };
}

function redCheck(name: string, source: string, sourceUrl: string, architectNote: string, verificationNote: string, rawReference: string): ConstraintCheck {
  return {
    status: "red",
    result: "yes",
    name,
    distance_m: 0,
    source,
    source_url: sourceUrl,
    confidence: "medium",
    architect_note: architectNote,
    verification_note: verificationNote,
    raw_reference: rawReference,
  };
}

function amberManualCheck(name: string, source: string, sourceUrl: string, architectNote: string, verificationNote: string): ConstraintCheck {
  return {
    status: "amber",
    result: "manual_check_required",
    name,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "low",
    architect_note: architectNote,
    verification_note: verificationNote,
    raw_reference: null,
  };
}

function greyManualCheck(name: string, source: string, sourceUrl: string, architectNote: string): ConstraintCheck {
  return {
    status: "grey",
    result: "manual_check_required",
    name,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "low",
    architect_note: architectNote,
    verification_note: "Manual or legal verification is required before relying on this result.",
    raw_reference: null,
  };
}

function greenNotFound(source: string, sourceUrl: string, architectNote: string): ConstraintCheck {
  return {
    status: "green",
    result: "not_found",
    name: null,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "medium",
    architect_note: architectNote,
    verification_note: "Local/manual verification is recommended before formal advice.",
    raw_reference: null,
  };
}

function greenNamedNotFound(name: string, source: string, sourceUrl: string, architectNote: string): ConstraintCheck {
  return {
    status: "green",
    result: "not_found",
    name,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "medium",
    architect_note: architectNote,
    verification_note: "Local/manual verification is recommended before formal advice.",
    raw_reference: null,
  };
}

function greenNo(name: string, source: string, sourceUrl: string, architectNote: string, verificationNote: string): ConstraintCheck {
  return {
    status: "green",
    result: "no",
    name,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "medium",
    architect_note: architectNote,
    verification_note: verificationNote,
    raw_reference: null,
  };
}

function amberPossible(name: string, source: string, sourceUrl: string, architectNote: string, verificationNote: string): ConstraintCheck {
  return {
    status: "amber",
    result: "possible",
    name,
    distance_m: null,
    source,
    source_url: sourceUrl,
    confidence: "low",
    architect_note: architectNote,
    verification_note: verificationNote,
    raw_reference: null,
  };
}

function postcodesIoResponse(value: unknown): PostcodesIoResponse {
  if (!isObjectRecord(value)) return { status: 500, result: null };
  const result = isObjectRecord(value.result) ? value.result : null;
  return {
    status: typeof value.status === "number" ? value.status : 500,
    result: result ? {
      postcode: stringOrUndefined(result.postcode),
      longitude: numberOrUndefined(result.longitude),
      latitude: numberOrUndefined(result.latitude),
      admin_district: stringOrUndefined(result.admin_district),
    } : null,
  };
}

function planningDataResponse(value: unknown): PlanningDataResponse {
  if (!isObjectRecord(value)) return {};
  return {
    count: numberOrUndefined(value.count),
    entities: Array.isArray(value.entities) ? value.entities.map(planningEntity).filter((entity) => entity !== null) : [],
  };
}

function nominatimSearchResults(value: unknown): NominatimSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObjectRecord).map((item) => ({
    display_name: stringOrUndefined(item.display_name),
    lat: stringOrUndefined(item.lat),
    lon: stringOrUndefined(item.lon),
  }));
}

function planningEntity(value: unknown): PlanningEntity | null {
  if (!isObjectRecord(value)) return null;
  const entity = numberOrUndefined(value.entity);
  if (entity === undefined) return null;
  return {
    entity,
    name: stringOrUndefined(value.name),
    dataset: stringOrUndefined(value.dataset),
    reference: stringOrUndefined(value.reference),
    quality: stringOrUndefined(value.quality),
    article_4_direction: stringOrUndefined(value["article-4-direction"]),
    permitted_development_rights: stringOrUndefined(value["permitted-development-rights"]),
    listed_building_grade: stringOrUndefined(value["listed-building-grade"]),
  };
}

function postcodeFromAddress(address: string): string | null {
  const match = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.exec(address);
  return match?.[1]?.toUpperCase().replace(/\s+/g, "") ?? null;
}

async function addressLookupResult(address: string): Promise<NominatimSearchResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "gb");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Studio McLeod Property Search",
    },
  });
  if (!response.ok) return null;
  return nominatimSearchResults(await response.json())[0] ?? null;
}

function postcodeFromInput(input: PropertyConstraintsSearchInput): string | null {
  const directPostcode = trimmedOrUndefined(input.propertyPostcode);
  return directPostcode ? formatCompactPostcode(directPostcode) : postcodeFromAddress(input.propertyAddress);
}

function formatCompactPostcode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}

function numberStringOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function entitiesForDataset(entities: PlanningEntity[], dataset: string): PlanningEntity[] {
  return entities.filter((entity) => entity.dataset === dataset);
}

function firstEntityForDataset(entities: PlanningEntity[], dataset: string): PlanningEntity | undefined {
  return entitiesForDataset(entities, dataset)[0];
}

function article4EntityName(entity: PlanningEntity): string {
  return [
    entity.name || `Article 4 Direction ${entity.reference ?? entity.entity}`,
    entity.permitted_development_rights,
  ].filter(Boolean).join(" - ");
}

function entityUrl(entity: PlanningEntity): string {
  return `https://www.planning.data.gov.uk/entity/${entity.entity}`;
}

function referenceForEntity(entity: PlanningEntity): string {
  return entity.reference ?? String(entity.entity);
}

function planningDataMapUrl(property: ResolvedPropertyContext): string {
  if (property.latitude === null || property.longitude === null) return "https://www.planning.data.gov.uk/map/";
  const url = new URL("https://www.planning.data.gov.uk/entity.json");
  url.searchParams.set("latitude", String(property.latitude));
  url.searchParams.set("longitude", String(property.longitude));
  return url.toString();
}

function mockResolvedAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return "Mock resolved address, Notting Hill, London W11 2BQ";
  if (trimmed.toLowerCase().includes("london")) return trimmed;
  return `${trimmed}, London W11 2BQ`;
}

function overallRisk(sections: Record<string, ConstraintCheck>[]): ConstraintStatus {
  const checks = sections.flatMap((section) => Object.values(section));
  if (checks.some((check) => check.status === "red")) return "red";
  if (checks.filter((check) => check.status === "amber").length >= 3) return "amber";
  if (checks.every((check) => check.status === "grey")) return "grey";
  return checks.some((check) => check.status === "amber" || check.status === "grey") ? "amber" : "green";
}

function textIncludes(value: string | undefined, needle: string): boolean {
  return value?.toLowerCase().includes(needle) === true;
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberOrNull(value: unknown): number | null {
  return numberOrUndefined(value) ?? null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
