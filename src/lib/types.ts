

import type { Timestamp } from 'firebase/firestore';

export type VehicleType = 'sedan' | 'suv' | 'truck';

export type PriceMap = {
  sedan: number;
  suv: number;
  truck: number;
}

export type DurationMap = {
  sedan: number; // Duration in minutes
  suv: number;
  truck: number;
}

export type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  squareCustomerId?: string;
  role?: 'admin' | 'washer';
  disabled?: boolean;
  createdAt?: Timestamp;
};

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  color: string;
  photoURL?: string;
};

export type ServiceAddress = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export type CarWashPackage = {
  id:string;
  name: string;
  description: string;
  prices: PriceMap;
  durations: DurationMap;
  serviceIds?: string[];
  popular?: boolean;
  imageKey?: string;
  photoURL?: string;
};

export type AddOn = {
  id: string;
  name: string;
  description: string;
  prices: PriceMap;
  durations: DurationMap;
};

export type Order = {
  id: string;
  userId: string;
  packageId: string;
  vehicleIds: string[];
  addressId: string;
  washerId?: string;
  appointmentDateTime: Timestamp;
  orderDate: Timestamp;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  price: number;
  addOnIds?: string[];
  reviewId?: string;
  paymentId?: string;
  paymentSourceId?: string;
  appointmentNote?: string;
  smsReminders?: boolean;
};

export type Review = {
    id: string;
    orderId: string;
    userId: string;
    washerId?: string;
    rating: number;
    comment: string;
    createdAt: Timestamp;
    customer?: UserProfile;
}

export type NotificationType = 'NEW_ORDER' | 'WASHER_ASSIGNED' | 'ORDER_COMPLETED';

export type Notification = {
    id: string;
    message: string;
    type: NotificationType;
    orderId: string;
    sentDateTime: Timestamp;
    read: boolean;
    userId: string; // ID of user who should see it (can be admin, washer, or client)
}

export type ChatMessage = {
    id: string;
    text: string;
    senderId: string;
    createdAt: Timestamp;
}
