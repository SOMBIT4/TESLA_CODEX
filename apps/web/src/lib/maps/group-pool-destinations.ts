import {
  DHAKA_AREAS,
  type DhakaArea,
  type DriverActivePoolMember,
} from "@/lib/api/types";

export interface DestinationGroup {
  zone: DhakaArea;
  members: { passengerName: string; seatsReserved: number }[];
}

export function groupPoolDestinations(
  members: readonly DriverActivePoolMember[],
): DestinationGroup[] {
  const groups = new Map<DhakaArea, DestinationGroup["members"]>();

  for (const member of members) {
    const destinationMembers = groups.get(member.destinationZone) ?? [];
    destinationMembers.push({
      passengerName: member.passengerName,
      seatsReserved: member.seatsReserved,
    });
    groups.set(member.destinationZone, destinationMembers);
  }

  return DHAKA_AREAS.flatMap((zone) => {
    const destinationMembers = groups.get(zone);
    return destinationMembers ? [{ zone, members: destinationMembers }] : [];
  });
}
