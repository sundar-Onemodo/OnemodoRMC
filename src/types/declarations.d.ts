declare module 'react-native-calendar-picker' {
  import { Component } from 'react';
  import { StyleProp, ViewStyle, TextStyle } from 'react-native';

  export interface CalendarPickerProps {
    startFromMonday?: boolean;
    allowRangeSelection?: boolean;
    allowBackwardRangeSelect?: boolean;
    selectedStartDate?: Date;
    selectedEndDate?: Date;
    onDateChange?: (date: any, type: 'START_DATE' | 'END_DATE') => void;
    minDate?: Date;
    maxDate?: Date;
    todayBackgroundColor?: string;
    selectedDayColor?: string;
    selectedDayTextColor?: string;
    selectedRangeStyle?: StyleProp<ViewStyle>;
    selectedRangeStartStyle?: StyleProp<ViewStyle>;
    selectedRangeEndStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabledDates?: any;
    disabledDatesTextStyle?: StyleProp<TextStyle>;
    nextTitleStyle?: StyleProp<TextStyle>;
    previousTitleStyle?: StyleProp<TextStyle>;
    width?: number;
    height?: number;
    [key: string]: any;
  }

  export default class CalendarPicker extends Component<CalendarPickerProps> {}
}
