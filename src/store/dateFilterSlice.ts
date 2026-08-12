import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { format, subDays } from "date-fns";

interface DateRangeState {
    startDate: string;
    endDate: string;
    activeFilter: string;
}

const getFormattedDate = (date: Date) => format(date, "yyyy-MM-dd");

const initialState: DateRangeState = {
    startDate: getFormattedDate(new Date()),
    endDate: getFormattedDate(new Date()),
    activeFilter: "Today",
};

const dateFilterSlice = createSlice({
    name: "dateFilter",
    initialState,
    reducers: {
        setPresetFilter: (state, action: PayloadAction<string>) => {
            const preset = action.payload;
            state.activeFilter = preset;
            const today = new Date();

            switch (preset) {
                case "Today":
                    state.startDate = getFormattedDate(today);
                    state.endDate = getFormattedDate(today);
                    break;
                case "Yesterday":
                    const yesterday = subDays(today, 1);
                    state.startDate = getFormattedDate(yesterday);
                    state.endDate = getFormattedDate(yesterday);
                    break;
                case "Last week":
                    state.startDate = getFormattedDate(subDays(today, 7));
                    state.endDate = getFormattedDate(today);
                    break;
                case "This week":
                    const currentDay = today.getDay();
                    const startOfWeek = subDays(today, currentDay);
                    state.startDate = getFormattedDate(startOfWeek);
                    state.endDate = getFormattedDate(today);
                    break;
                case "This month":
                    state.startDate = format(
                        new Date(today.getFullYear(), today.getMonth(), 1),
                        "yyyy-MM-dd",
                    );
                    state.endDate = getFormattedDate(today);
                    break;
                case "Last month":
                    const firstOfLastMonth = new Date(
                        today.getFullYear(),
                        today.getMonth() - 1,
                        1,
                    );
                    const lastOfLastMonth = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        0,
                    );
                    state.startDate = format(firstOfLastMonth, "yyyy-MM-dd");
                    state.endDate = format(lastOfLastMonth, "yyyy-MM-dd");
                    break;
                default:
                    break;
            }
        },
        setCustomRange: (
            state,
            action: PayloadAction<{ startDate: string; endDate: string }>,
        ) => {
            state.activeFilter = "Custom";
            state.startDate = action.payload.startDate;
            state.endDate = action.payload.endDate;
        },
    },
});

export const { setPresetFilter, setCustomRange } = dateFilterSlice.actions;
export default dateFilterSlice.reducer;

