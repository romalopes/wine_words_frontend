/**
 * The editable profile form shared by AccountSettings and UserDetail.
 * Every field is a string so controlled inputs stay simple.
 */
export interface PersonalInformationForm {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    country_id: string;
  };
}

export const EMPTY_PERSONAL_INFORMATION: PersonalInformationForm = {
  first_name: "",
  last_name: "",
  phone: "",
  date_of_birth: "",
  address: {
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    country_id: "",
  },
};

export type PersonalField = Exclude<keyof PersonalInformationForm, "address">;
export type PersonalAddressField = keyof PersonalInformationForm["address"];
