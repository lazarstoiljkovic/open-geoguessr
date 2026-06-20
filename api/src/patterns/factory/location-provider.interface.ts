import { Location } from 'src/types';

export interface ILocationProvider {
  getLocation(): Promise<Location>;
}
