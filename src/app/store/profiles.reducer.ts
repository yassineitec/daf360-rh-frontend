import { createReducer } from '@ngrx/store';

export interface RhProfilesState {}

const initialState: RhProfilesState = {};

export const rhProfilesReducer = createReducer(initialState);
