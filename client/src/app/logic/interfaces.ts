export interface Profile {
    display: string;
    image: string;
}

export interface Gift {
    image: string;
    name: string;
    stars: number;
}

export interface KidProfile extends Profile {
    bag: Gift[];
    stars: number;
}

export interface State {
    profile: Profile;
    kids: KidProfile[];
    gifts: Gift[];
}