import { Injectable } from '@angular/core';

import { AppState } from 'src/app/logic/state';
import { IGift, IKid, IState, IStateStore } from './logic/interfaces';
import { StateActions, UpdateKidStarsAction } from "./logic/actions/actions.state";


@Injectable({ providedIn: 'root' })
export class AppService {
    _state: IState;
    public UpdateKidStarsAction: UpdateKidStarsAction;
    constructor() {
        
    }
    
    init() {
        this._state = new AppState();
        this.UpdateKidStarsAction = new UpdateKidStarsAction(this._state);
    }

    get state(): IStateStore {
        return this._state.getState();
    }

    updateKids( ...kids: Partial<IKid>[]) {
        StateActions.updateKids(this._state, ...kids);
    }

    updateGifts( ...gifts: Partial<IGift>[]) {
        StateActions.updateGifts(this._state, ...gifts);
    }
    
    removeKids( ...kids: Partial<IKid>[]) {
        StateActions.removeKids(this._state, ...kids);
    }

    removeGifts( ...gifts: Partial<IGift>[]) {
        StateActions.removeGifts(this._state, ...gifts);
    }
}