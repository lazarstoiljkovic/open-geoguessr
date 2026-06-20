import { Location } from 'src/types';
import { shuffleArray } from 'src/utils/geo.utils';
import { ILocationProvider } from '../location-provider.interface';

const FAMOUS_LOCATIONS: Omit<Location, 'imageUrl' | 'images' | 'mapillaryImageId'>[] = [
  { id: 'f1',  name: 'Eiffel Tower',           country: 'France',           lat: 48.8584,   lng: 2.2945,    wikipediaTitle: '' },
  { id: 'f2',  name: 'Colosseum',              country: 'Italy',            lat: 41.8902,   lng: 12.4922,   wikipediaTitle: '' },
  { id: 'f3',  name: 'Statue of Liberty',      country: 'USA',              lat: 40.6892,   lng: -74.0445,  wikipediaTitle: '' },
  { id: 'f4',  name: 'Machu Picchu',           country: 'Peru',             lat: -13.1631,  lng: -72.545,   wikipediaTitle: '' },
  { id: 'f5',  name: 'Taj Mahal',              country: 'India',            lat: 27.1751,   lng: 78.0421,   wikipediaTitle: '' },
  { id: 'f6',  name: 'Sagrada Família',        country: 'Spain',            lat: 41.4036,   lng: 2.1744,    wikipediaTitle: '' },
  { id: 'f7',  name: 'Big Ben',                country: 'UK',               lat: 51.5007,   lng: -0.1246,   wikipediaTitle: '' },
  { id: 'f8',  name: 'Sydney Opera House',     country: 'Australia',        lat: -33.8568,  lng: 151.2153,  wikipediaTitle: '' },
  { id: 'f9',  name: 'Great Wall of China',    country: 'China',            lat: 40.4319,   lng: 116.5704,  wikipediaTitle: '' },
  { id: 'f10', name: 'Niagara Falls',          country: 'Canada/USA',       lat: 43.0962,   lng: -79.0377,  wikipediaTitle: '' },
  { id: 'f11', name: 'Chichen Itza',           country: 'Mexico',           lat: 20.6843,   lng: -88.5678,  wikipediaTitle: '' },
  { id: 'f12', name: 'Acropolis of Athens',    country: 'Greece',           lat: 37.9715,   lng: 23.7267,   wikipediaTitle: '' },
  { id: 'f13', name: 'Burj Khalifa',           country: 'UAE',              lat: 25.1972,   lng: 55.2744,   wikipediaTitle: '' },
  { id: 'f14', name: 'Christ the Redeemer',    country: 'Brazil',           lat: -22.9519,  lng: -43.2105,  wikipediaTitle: '' },
  { id: 'f15', name: 'Stonehenge',             country: 'UK',               lat: 51.1789,   lng: -1.8262,   wikipediaTitle: '' },
  { id: 'f16', name: 'Petra',                  country: 'Jordan',           lat: 30.3285,   lng: 35.4444,   wikipediaTitle: '' },
  { id: 'f17', name: 'Mount Fuji',             country: 'Japan',            lat: 35.3606,   lng: 138.7274,  wikipediaTitle: '' },
  { id: 'f18', name: 'Neuschwanstein Castle',  country: 'Germany',          lat: 47.5576,   lng: 10.7498,   wikipediaTitle: '' },
  { id: 'f19', name: 'Angkor Wat',             country: 'Cambodia',         lat: 13.4125,   lng: 103.867,   wikipediaTitle: '' },
  { id: 'f20', name: 'Santorini',              country: 'Greece',           lat: 36.3932,   lng: 25.4615,   wikipediaTitle: '' },
  { id: 'f21', name: 'Pyramids of Giza',       country: 'Egypt',            lat: 29.9792,   lng: 31.1342,   wikipediaTitle: '' },
  { id: 'f22', name: 'Alhambra',               country: 'Spain',            lat: 37.1772,   lng: -3.5902,   wikipediaTitle: '' },
  { id: 'f23', name: 'Hagia Sophia',           country: 'Turkey',           lat: 41.0086,   lng: 28.9802,   wikipediaTitle: '' },
  { id: 'f24', name: 'Golden Gate Bridge',     country: 'USA',              lat: 37.8199,   lng: -122.4783, wikipediaTitle: '' },
  { id: 'f25', name: 'Victoria Falls',         country: 'Zimbabwe/Zambia',  lat: -17.9243,  lng: 25.8572,   wikipediaTitle: '' },
  { id: 'f26', name: 'Tokyo Tower',            country: 'Japan',            lat: 35.6586,   lng: 139.7454,  wikipediaTitle: '' },
  { id: 'f27', name: 'Pompeii',                country: 'Italy',            lat: 40.7497,   lng: 14.4997,   wikipediaTitle: '' },
  { id: 'f28', name: 'Edinburgh Castle',       country: 'UK',               lat: 55.9486,   lng: -3.1999,   wikipediaTitle: '' },
  { id: 'f29', name: 'Louvre Museum',          country: 'France',           lat: 48.8606,   lng: 2.3376,    wikipediaTitle: '' },
  { id: 'f30', name: 'Colmar',                 country: 'France',           lat: 48.0794,   lng: 7.3585,    wikipediaTitle: '' },
  { id: 'f31', name: 'Hallstatt',              country: 'Austria',          lat: 47.5622,   lng: 13.6493,   wikipediaTitle: '' },
  { id: 'f32', name: 'Dubrovnik Old Town',     country: 'Croatia',          lat: 42.6410,   lng: 18.1076,   wikipediaTitle: '' },
  { id: 'f33', name: 'Charles Bridge',         country: 'Czech Republic',   lat: 50.0865,   lng: 14.4114,   wikipediaTitle: '' },
  { id: 'f34', name: "St. Basil's Cathedral",  country: 'Russia',           lat: 55.7525,   lng: 37.6231,   wikipediaTitle: '' },
  { id: 'f35', name: 'Moai, Easter Island',    country: 'Chile',            lat: -27.1127,  lng: -109.3497, wikipediaTitle: '' },
  { id: 'f36', name: 'Meteora',                country: 'Greece',           lat: 39.7217,   lng: 21.6306,   wikipediaTitle: '' },
  { id: 'f37', name: 'Plitvice Lakes',         country: 'Croatia',          lat: 44.8654,   lng: 15.5820,   wikipediaTitle: '' },
  { id: 'f38', name: 'Zhangjiajie',            country: 'China',            lat: 29.3245,   lng: 110.4344,  wikipediaTitle: '' },
  { id: 'f39', name: 'Blue Mosque',            country: 'Turkey',           lat: 41.0054,   lng: 28.9768,   wikipediaTitle: '' },
];

export class FamousLocationProvider implements ILocationProvider {
  async getLocation(): Promise<Location> {
    const loc = shuffleArray([...FAMOUS_LOCATIONS])[0];
    return { ...loc, imageUrl: undefined, images: [], mapillaryImageId: undefined };
  }
}
