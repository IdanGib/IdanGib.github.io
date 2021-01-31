interface IStateEntity {
    id: string;
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

export interface IKidProfile extends IProfile {
    bag: IGift[];
    stars: number;
}

export interface IState {
    profile: IProfile;
    kids: IKidProfile[];
    gifts: IGift[];
}