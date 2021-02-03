interface IStateEntity {
    id?: string;
}

export interface IProfile extends IStateEntity {
    name: string;
    image: string;
}

export interface IGift extends IStateEntity  {
    image: string;
    name: string;
    stars: number;
}

export interface IKid extends IProfile {
    bag: IGift[];
    stars: number;
    updateStars: (n: number) => void;
    addToBag: (...gifts: IGift[]) => void;
    removeFromBag: (...gifts: IGift[]) => number ;
}

export interface IStateStore {
    profile: IProfile;
    kids: IKid[];
    gifts: IGift[];
}

export interface IState extends IStateStore {
    save: () => void;
    getState(): IStateStore;
}