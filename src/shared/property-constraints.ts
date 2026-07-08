export type ConstraintStatus = "red" | "amber" | "green" | "grey";

export type ConstraintResultValue =
  | "yes"
  | "no"
  | "not_found"
  | "possible"
  | "manual_check_required"
  | "not_applicable"
  | "error";

export type ConstraintConfidence = "high" | "medium" | "low";

export type PropertyConstraintSearchDepth = "quick" | "in_depth";

export type PropertyProjectType =
  | "House extension"
  | "Loft conversion"
  | "Basement"
  | "New dwelling"
  | "Flat conversion"
  | "Listed building works"
  | "Change of use"
  | "Commercial"
  | "Garden studio/outbuilding"
  | "Pre-purchase review"
  | "Other";

export interface ConstraintCheck {
  status: ConstraintStatus;
  result: ConstraintResultValue;
  name: string | null;
  distance_m: number | null;
  source: string;
  source_url: string | null;
  confidence: ConstraintConfidence;
  architect_note: string;
  verification_note?: string;
  raw_reference?: string | null;
}

export interface PropertyTitleDetails {
  tenure: "freehold" | "leasehold" | "both_detected" | "not_known";
  title_numbers: string[];
  lease?: {
    term: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  proprietor?: {
    type: "private_individual" | "company" | "public_body" | "unknown";
    name: string | null;
  };
  confidence: "official_tenure" | "inferred_share_of_freehold" | "manual_check_required";
  source: string;
  notes: string;
}

export interface PropertyConstraintsReport {
  client: {
    client_name: string;
    email?: string;
    phone?: string;
    project_reference?: string;
  };
  property: {
    input_address: string;
    resolved_address: string | null;
    uprn: string | null;
    latitude: number | null;
    longitude: number | null;
    postcode: string | null;
    local_authority: string | null;
  };
  search: {
    search_date: string;
    search_depth: PropertyConstraintSearchDepth;
    tool_version: string;
    overall_risk: ConstraintStatus;
  };
  planning_heritage: Record<string, ConstraintCheck>;
  trees_ecology_landscape: Record<string, ConstraintCheck>;
  flood_ground_environment: Record<string, ConstraintCheck>;
  planning_potential: Record<string, ConstraintCheck>;
  access_highways_practical: Record<string, ConstraintCheck>;
  legal_ownership: Record<string, ConstraintCheck>;
  title_details: PropertyTitleDetails;
  source_links: PropertyConstraintSourceLink[];
  recommended_next_steps: string[];
  caveats: string[];
}

export interface PropertyConstraintSourceLink {
  label: string;
  url: string;
  notes?: string;
}

export interface PropertyConstraintsSearchInput {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectReference?: string;
  propertyAddress: string;
  propertyPostcode: string;
  searchDepth: PropertyConstraintSearchDepth;
  projectTypes: PropertyProjectType[];
  proposedWorks?: string;
  knownLocalAuthority?: string;
  notes?: string;
}

export interface PropertyConstraintsSearchResponse {
  report: PropertyConstraintsReport;
}

export type PropertySearchStatus = "saved_search" | "active_project";

export interface PropertySearchRecord {
  id: string;
  userId: string;
  clientName: string;
  propertyAddress: string;
  postcode: string;
  projectReference?: string;
  projectNumber?: string;
  status: PropertySearchStatus;
  report: PropertyConstraintsReport;
  createdAt: string;
  updatedAt: string;
}

export interface SavePropertySearchInput {
  report: PropertyConstraintsReport;
}

export interface PropertySearchesResponse {
  searches: PropertySearchRecord[];
}

export interface SavePropertySearchResponse {
  search: PropertySearchRecord;
}

export interface PromotePropertySearchInput {
  projectNumber: string;
}

export const PROPERTY_PROJECT_TYPES: PropertyProjectType[] = [
  "House extension",
  "Loft conversion",
  "Basement",
  "New dwelling",
  "Flat conversion",
  "Listed building works",
  "Change of use",
  "Commercial",
  "Garden studio/outbuilding",
  "Pre-purchase review",
  "Other",
];
