export function countryName(name: string): string {
  const aliases: Record<string,string> = {
    'united states of america':'United States', 'united states':'United States', usa:'United States', us:'United States',
    uk:'United Kingdom', 'united kingdom':'United Kingdom', 'great britain':'United Kingdom',
    'russian federation':'Russia', 'czech republic':'Czechia', 's. sudan':'South Sudan',
    'dominican rep.':'Dominican Republic', 'central african rep.':'Central African Republic',
    'dem. rep. congo':'Democratic Republic of the Congo', 'eq. guinea':'Equatorial Guinea',
    'bosnia and herz.':'Bosnia and Herzegovina', 'solomon is.':'Solomon Islands',
  };
  return aliases[name.trim().toLowerCase()] || name.trim();
}
export function sameCountry(a: string, b: string): boolean {
  return countryName(a).toLowerCase() === countryName(b).toLowerCase();
}
