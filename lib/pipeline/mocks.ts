/**
 * Mock data for small_boats (v1). Drop-in replacement with real APIs later.
 */

import type { RawMediaItem, RawPollItem, RawMetricItem } from "./types";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const MOCK_MEDIA_HEADLINES: RawMediaItem[] = [
  { id: "m1", outlet: "BBC", title: "Government unveils new crackdown on small boat crossings", lede: "Ministers announce tougher measures.", published_at: `${daysAgo(2)}T10:00:00Z`, url: "https://example.com/bbc1" },
  { id: "m2", outlet: "The Guardian", title: "Illegal migration bill faces legal challenge from charities", lede: "Human rights groups seek judicial review.", published_at: `${daysAgo(3)}T14:00:00Z`, url: "https://example.com/guardian1" },
  { id: "m3", outlet: "Sky News", title: "Border force intercepts 50 boats in single day", lede: "Record day for interceptions.", published_at: `${daysAgo(1)}T08:00:00Z`, url: "https://example.com/sky1" },
  { id: "m4", outlet: "Telegraph", title: "Stop the boats: PM pledges new deterrent measures", lede: "Security-first approach.", published_at: `${daysAgo(4)}T09:00:00Z` },
  { id: "m5", outlet: "BBC", title: "Charity warns of deaths at sea without safe routes", lede: "Humanitarian groups call for safe passage.", published_at: `${daysAgo(5)}T11:00:00Z` },
  { id: "m6", outlet: "The Guardian", title: "ECHR ruling could block Rwanda removals", lede: "Legal process in focus.", published_at: `${daysAgo(6)}T16:00:00Z` },
  { id: "m7", outlet: "Sky News", title: "Traffickers exploiting Channel route, says minister", lede: "Criminal gangs and border security.", published_at: `${daysAgo(0)}T07:00:00Z` },
  { id: "m8", outlet: "Reuters", title: "UK asylum backlog hits new high", lede: "Capacity and processing delays.", published_at: `${daysAgo(2)}T12:00:00Z` },
];

export const MOCK_POLLS: RawPollItem[] = [
  {
    id: "p1",
    pollster: "YouGov",
    question: "Do you support tougher measures to stop small boat crossings?",
    options: ["Yes, tougher measures", "No, more humane approach", "Don't know"],
    results: [0.58, 0.35, 0.07],
    fieldwork_dates: `${daysAgo(7)} to ${daysAgo(5)}`,
    published_at: `${daysAgo(4)}T00:00:00Z`,
    url: "https://example.com/yougov1",
  },
  {
    id: "p2",
    pollster: "Savanta",
    question: "Should the UK prioritise border control or protecting refugees?",
    options: ["Border control", "Protecting refugees", "Both equally"],
    results: [0.52, 0.28, 0.20],
    fieldwork_dates: `${daysAgo(14)} to ${daysAgo(10)}`,
    published_at: `${daysAgo(9)}T00:00:00Z`,
  },
  {
    id: "p3",
    pollster: "Opinium",
    question: "Is the government right to pursue Rwanda-style schemes?",
    options: ["Yes", "No", "Don't know"],
    results: [0.48, 0.42, 0.10],
    fieldwork_dates: `${daysAgo(3)} to ${daysAgo(1)}`,
    published_at: `${daysAgo(0)}T00:00:00Z`,
  },
];

export const MOCK_REALITY_METRICS: RawMetricItem[] = [
  {
    metric_id: "crossings",
    label: "Channel crossings",
    unit: "count",
    latest_value: 8500,
    previous_value: 10000,
    period: "last 12 months",
    updated_at: `${daysAgo(0)}T00:00:00Z`,
    source_ref: "Home Office stats",
  },
  {
    metric_id: "deaths",
    label: "Deaths at sea",
    unit: "count",
    latest_value: 12,
    previous_value: 8,
    period: "last 6 months",
    updated_at: `${daysAgo(1)}T00:00:00Z`,
    source_ref: "IOM",
  },
  {
    metric_id: "backlog",
    label: "Asylum backlog",
    unit: "count",
    latest_value: 95000,
    previous_value: 90000,
    period: "latest",
    updated_at: `${daysAgo(2)}T00:00:00Z`,
    source_ref: "Home Office",
  },
];
