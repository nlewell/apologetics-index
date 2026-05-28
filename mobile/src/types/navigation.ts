import { IndexItem } from './index';

export type RootStackParamList = {
  Home: undefined;
  IndexItems: undefined;
  IndexItemDetail: {
    item: IndexItem;
  };
  Search: undefined;
};
