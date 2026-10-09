import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface PlantInfo {
    id: number;
    plant_name: string;
}

interface RmcUser {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    default_entity_id: number;
    default_plant_id: number;
    profile_photo_url: string;
    plants?: PlantInfo[];
    username?: string;
    last_login?: string;
    login_location?: string;
}


interface RmcAuthState {
    user: RmcUser | null;
    token: string | null;
    token_type: string | null;
    plant_name: string | null;
    plant_id: number | null;
    isLoading: boolean;
    isError: boolean;
    errorMessage: string;
}

const initialState: RmcAuthState = {
    user: null,
    token: null,
    token_type: null,
    plant_name: null,
    plant_id: null,
    isLoading: false,
    isError: false,
    errorMessage: "",
};


export const loginUser = createAsyncThunk(
    "auth/loginUser",
    async (payload: {
        email?: string;
        password?: string
    }, thunkAPI) => {
        try {
            const res = await axios.post(
                `https://modormc.com/api/mobile/login`, //live url
                // `https://curie.modormc.com/api/mobile/login`, // testing url
                {
                    email: payload.email,
                    password: payload.password,
                }, {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "DashboardApp",
                },
            },
            );

            const data = res.data;

            if (data.token) {
                await AsyncStorage.setItem("user_rmc", JSON.stringify(data))
                return data;
            }
            return thunkAPI.rejectWithValue(data.message || "Invalid RMC Login");
        } catch (err: any) {
            return thunkAPI.rejectWithValue(
                err?.response?.data?.message || err.message || "RMC Login Failed",
            );
        }
    },
);

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        resetRmcAuth: (state) => {
            state.user = null;
            state.token = null;
            state.token_type = null;
            state.isLoading = false;
            state.isError = false;
            state.errorMessage = "";
        },
        setSelectedPlant: (state, action: PayloadAction<{ id: number; plant_name: string }>) => {
            state.plant_id = action.payload.id;
            state.plant_name = action.payload.plant_name;
        },
        setRmcUserFromStorage: (state, action) => {
            const userData = action.payload;
            if (userData) {
                state.user = userData.user || null;
                state.token = userData.token || null;
                state.token_type = userData.token_type || null;

                const lastPlantId = state.plant_id;
                const plants = userData?.user?.plants || [];
                const foundPlant = plants.find((p: any) => p.id === lastPlantId);
                const plant = foundPlant || plants[0];

                state.plant_name = plant?.plant_name || "No Plant";
                state.plant_id = plant?.id || null;
            }
        },
        updateUser: (state, action: PayloadAction<Partial<RmcUser> & { username?: string }>) => {
            if (state.user) {
                const updatedUser = {
                    ...state.user,
                    ...action.payload,
                    name: action.payload.username || action.payload.name || state.user.name,
                };
                state.user = updatedUser;
                // Update AsyncStorage user_rmc as well
                AsyncStorage.getItem("user_rmc").then((stored) => {
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        parsed.user = { ...parsed.user, ...updatedUser };
                        AsyncStorage.setItem("user_rmc", JSON.stringify(parsed));
                    }
                }).catch((err) => console.log("Failed to update user_rmc in storage:", err));
            }
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
                state.isError = false;
                state.errorMessage = "";
            })
            .addCase(loginUser.fulfilled, (state, action: any) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.token_type = action.payload.token_type;

                const lastPlantId = state.plant_id;
                const plants = action.payload?.user?.plants || [];
                const foundPlant = plants.find((p: any) => p.id === lastPlantId);
                const plant = foundPlant || plants[0];

                state.plant_name = plant?.plant_name || "No Plant";
                state.plant_id = plant?.id || null;
            })
            .addCase(loginUser.rejected, (state, action: any) => {
                state.isLoading = false;
                state.isError = true;
                state.errorMessage = action.payload;
            })
    }

});

export const { resetRmcAuth, setSelectedPlant, setRmcUserFromStorage, updateUser } = authSlice.actions
export default authSlice.reducer;