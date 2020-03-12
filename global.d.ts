import {Instance, Model, DataTypes, QueryInterface, Sequelize, Transaction, SequelizeStatic} from 'sequelize';
import {NextFunction} from 'express-serve-static-core';
import {Moment} from 'moment';
import sequelize from 'sequelize'

/** Adds interfaces and types to the global namespace to improve the 
 * intellisense of the Javascript code in VS Code.
 * 
 * To use, add JS Doc containing @type snippets to variables, imports or functions.*/
declare global {

    // GENERIC TYPES --------------------------------------------------------
    //-----------------------------------------------------------------------
    /**
     * Provides intellisense for migration and seeding modules in the global namespace
     * 
     * To use, create a new variable and assign it the queryInterface argument, 
     * then use add a JSdoc to this variable with the snippet @type.
     */
    type JetQueryInterface = QueryInterface;

    /**
     * Provides intellisense for Sequelize DataTypes in the global namespace
     * 
     * To use, add a JSdoc with a snippet referring to this @type on the require
     * statement of a module.
     */
    type JetDataTypes = DataTypes

    /**
     * Provides intellisense for Sequelize DataTypes in the global namespace
     * 
     * To use, add a JSdoc with a snippet referring to this @type on the require
     * statement of a module.
     */
    type JetSequelizeStatic = SequelizeStatic;

    /**
     * Provides intellisense for Sequelize in the global namespace
     * 
     * To use, add a JSdoc with a snippet referring to this @type on the require
     * statement of a module.
     */
    type JetSequelize = Sequelize;

    type JetTransaction = Transaction;

    type JetErrors = {errors: {[errorType: string]: string}};

    // ENUM TYPES -----------------------------------------------------------
    //-----------------------------------------------------------------------
    type JetTravelerAgeBrackets = '18-21' | '20s' | '30s' | '40s' | '50s' | '60s' | '70s'| '80+';
    type JetTravelerGender = 'm' | 'f';
    type JetUserTravelerStatus = 'pending' | 'active' | 'suspended';
    type JetUserTravelerRelation = 'self' | 'relative' | 'friend' | 'coworker' | 'employee' | 'member' | 'client';
    type JetAddressType = 'home' | 'office' | 'hotel' | 'conference' | 'stadium';
    type JetTripType = 'onward' | 'return' | 'oneway' | 'openjaw' | 'loop';
    type JetBookingStatus = 'manual' | 'confirmed' | 'auto' | 'autoconfirmed' | 'gdsconfirm' | 'agentconfirm';
    type JetViaChange = 'add' | 'del' | 'chg' | 'idm';
    type JetRideStatus = 'open' | 'closed' | 'full' | 'disabled';
    type JetRideType = 'shareCab' | 'cabRide' | 'ownCar' | 'rentalCar' | 'relativeCar';
    type JetRideWay = 'airport' | 'city';
    type JetPayPref = 'jetaid' | 'cash' | 'flex';
    type JetSmokePref = 'nosmoke' | 'allowsmoke' | 'flex';
    type JetPetPref = 'nopet' | 'allowpet' | 'flex';
    type JetCurbPref = 'curbonly' | 'allowparking' | 'allowunderground' | 'flex';
    type JetRiderPref = 'cabOnly' | 'cabOrStaff' | 'cabOrCar' | 'staffOrCar' | 'any';
    type JetRiderStatus = 'driver' | 'provider' | 'owner' | 'admin' | 'joined' | 'applied' | 'denied' | 'saved' | 'left';
    type JetConvoType = 'ride' | 'applicant' | 'help';
    type JetMessageStatus = 'pending' | 'delivered' | 'read';
    type JetTaskType = 'flightonly' | 'homeflight' | 'flighthome' | 'homehome';
    type JetTaskStatus = 'open' | 'closed' | 'disabled';
    type JetHelpStatus = 'helpee' | 'helper' | 'backup' | 'applied' | 'invited' | 'pulled' | 'contacted' | 'cancelled' | 'incompatible';
    type JetBound = 'dep' | 'arr';
    type JetTaskNoticeType = 'status_change' | 'rank_change' | 'new_messages';
    type JetTaskNoticeSubType = 'joined_as_helper' | 'joined_as_backup' | 'was_admitted_helper' | 'was_admitted_backup' |
                                'was_promoted_helper' | 'was_demoted_backup' | 'was_expelled' | 'has_left' |
                                'rank_upgrade' | 'rank_downgrade' |
                                'has_applied' | 'was_invited' | 'invite_was_cancelled' | 'has_pulled_application' |
                                'now_incompatible' |
                                'message_tasker' | 'message_helpees' |
                                'unknown'
    type JetTaskNoticeStatus = 'pending' | 'ready' | 'partial' | 'complete';
    type JetUserNoticeStatus = 'pending' | 'sent' | 'read';
    type JetNoticeSide = 'both' | 'to_member' | 'to_admins';

    //-----------------------------------------------------------------------
    type JetAirlineKeyType = 'iata' | 'icao' | 'name';
    type JetTaskAssemblerType = 'ownTask' | 'otherTask' | 'ownProvTask' | 'otherProvTask';
    type JetTaskRequestType = 'via' | 'prov';
    type JetChangeType = 'none' | 'minimal' | 'breaking' | 'expanding' | 'restrictive';
    type JetExtendOption = 'airport';


    // QUERIES --------------------------------------------------------------
    //----------------------------------------------------------------------- 
    type JetQueries = {
        FETCH_USER_PROFILE: sequelize.FindOptions<JetUserInstance>;
        FETCH_TRAVELER_PROFILE: sequelize.FindOptions<JetTravelerInstance>;
        FETCH_VIAS: sequelize.FindOptions<JetViaInstance>;
        FETCH_UPDATING_TRIP: sequelize.FindOptions<JetTripInstance>;
        FETCH_RIDER_TRIP: sequelize.FindOptions<JetTripInstance>;
        FETCH_RIDER: sequelize.FindOptions<JetRiderInstance>;
        FETCH_UPDATING_RIDER: sequelize.FindOptions<JetRiderInstance>;
        FETCH_LIST_RIDER: sequelize.FindOptions<JetRiderInstance>;
        FETCH_SEARCH_RIDER: sequelize.FindOptions<JetRiderInstance>;
        FETCH_SEARCH_RIDER_DETAILS: sequelize.FindOptions<JetRiderInstance>;
        FETCH_RIDER_HOODAGGLOTERM: sequelize.FindOptions<JetRiderInstance>;
        FETCH_RIDER_TRAVSHOODTERM: sequelize.FindOptions<JetRiderInstance>;
        FETCH_CURRENT_RIDE: sequelize.FindOptions<JetRideInstance>;
        FETCH_SUSPENDED_RIDE: sequelize.FindOptions<JetRideInstance>;
        FETCH_APPLICANT: sequelize.FindOptions<JetRiderInstance>;
        FETCH_APPLICATION: sequelize.FindOptions<JetRideRiderInstance>;
        FETCH_CORIDER: sequelize.FindOptions<JetRideRiderInstance>;
        FETCH_PUBLIC_RIDE: sequelize.FindOptions<JetRideInstance>;
        FETCH_SELECT_RIDE: sequelize.FindOptions<JetRideInstance>;
        FETCH_SELECT_RIDE_RIDER: sequelize.FindOptions<JetRideRiderInstance>;
        FETCH_RIDE_RIDER_REQUEST: sequelize.FindOptions<JetRideRiderRequestInstance>;
        FETCH_RIDE_RIDER_CONVO: sequelize.FindOptions<JetConvoInstance>;
        FETCH_ASSOCIATED_HOOD: sequelize.FindOptions<JetNeighborhoodInstance>;
        FETCH_ASSOCIATED_ADDRESS: sequelize.FindOptions<JetAddressInstance>;
        FETCH_ASSOCIATED_AIRPORT: sequelize.FindOptions<JetAirportInstance>;
        FETCH_ASSOCIATED_FLIGHT: sequelize.FindOptions<JetFlightInstance>;
        FETCH_TASK_TRIP: sequelize.FindOptions<JetTripInstance>;
        FETCH_ASSOCIATED_VIA: sequelize.FindOptions<JetViaInstance>;
        FETCH_UPDATE_PROVISIONAL_TASK: sequelize.FindOptions<JetTaskInstance>;
        FETCH_UPDATE_FROMVIA_TASK: sequelize.FindOptions<JetTaskInstance>;
        FETCH_REVIEW_PROVISIONAL_TASK: sequelize.FindOptions<JetTaskInstance>;
        FETCH_REVIEW_FROMVIA_TASK: sequelize.FindOptions<JetTaskInstance>;

        FETCH_FILTERING_VIA: sequelize.FindOptions<JetViaInstance>;
        find_provTasks(via: JetViaInstance): sequelize.FindOptions<JetTaskInstance>;
        FETCH_FIND_FROMVIA_TASK: sequelize.FindOptions<JetTaskInstance>;

        FETCH_DETAILS_FROMVIA_TASK: sequelize.FindOptions<JetTaskInstance>;
        /** Task from trip --> no need to fetch the via, but retrieves addresses */
        FETCH_EXTENDED_DETAILS_FROMVIA_TASK: sequelize.FindOptions<JetTaskInstance>;
        FETCH_DETAILS_PROVISIONAL_TASK: sequelize.FindOptions<JetTaskInstance>;

        FETCH_TASK_VIA_TRAVELER_CONVO: sequelize.FindOptions<JetConvoInstance>;
        FETCH_TASK_USERS: sequelize.FindOptions<JetTaskUserInstance>;

        FETCH_TASK_FULL: sequelize.FindOptions<JetTaskInstance>;
        FETCH_FILTERING_TASK: sequelize.FindOptions<JetTaskInstance>;

        FETCH_MEMBER: sequelize.FindOptions<JetTaskViaTravelerInstance>;
        FETCH_PASSENGER: sequelize.FindOptions<JetViaTravelerInstance>;
        FETCH_PASSENGERVIA: sequelize.FindOptions<JetViaInstance>;
        FETCH_FINDPASSENGER: sequelize.FindOptions<JetViaTravelerInstance>;

        // CASCADING QUERIES
        FETCH_RIDER_VIACASCADE: sequelize.FindOptions<JetRiderInstance>;
        FETCH_RIDER_PASSENGERCASCADE: sequelize.FindOptions<JetRiderInstance>;
        FETCH_PASSENGER_VIACASCADE: sequelize.FindOptions<JetViaTravelerInstance>;
        FETCH_RIDE_RIDERCASCADE: sequelize.FindOptions<JetRideInstance>;
        FETCH_TASK_PASSENGERCASCADE: sequelize.FindOptions<JetTaskInstance>;
        FETCH_TASK_VIACASCADE: sequelize.FindOptions<JetTaskInstance>;
    };


    // REQUESTS -------------------------------------------------------------
    //-----------------------------------------------------------------------
    interface JetUserRequest {
        profile: {
            name: string;
            email: string;
        }
    }

    interface JetUserTravelerRequest {
        nickname: string;
        relation: JetUserTravelerRelation;
    }

    interface JetTravelerRequest {
        userTraveler: JetUserTravelerRequest;
        traveler: {
            firstName: string;
            lastName: string;
            middleName: string;
            publicName: string;
            email: string;
            dob: string;
            ageBracket: JetTravelerAgeBrackets;
            gender: JetTravelerGender;
            pic: number;
        }
    }

    interface JetAddressInfoRequest {
        buildingName: string,
        apartmentIdentifier: string,
        floorIdentifier: string,
        postcode: string,
        buildingDescription: string,
        accessDescription: string
    }


    /** Component of a request or response describing an address*/
    interface JetAddressRequest {
        location: {
            latitude: number,
            longitude: number,
            locator: string,
            provider: string
        };
        details: {
            streetName: string,
            streetNumber: string,
            cityName: string,
            stateCode: string,
            stateName: string,
            countryCode: string,
            countryName: string,
            countyHint: string
        },
        infos?: JetAddressInfoRequest;

        /** to be populated by backend */
        createInfos?: boolean;
        /** to be populated by backend */
        geolocated?: boolean;
    }

    interface JetReferencedAddressRequest extends JetAddressRequest {
        references: {
            ref?: string,
            alias: string,
            type: string
        }
        /** to be populateed by backend */
        userAddress?: JetUserAddressInstance;
        /** to be populateed by backend */
        travAddress?: JetTravelerAddressInstance;
        /** to be populated by backend */
        address?: JetAddressInstance;
        /** to be populated by backend */
        addressInfo?: JetAddressInfoInstance;
    }

    interface JetPhoneRequest {
        ref?: string;
        alias?: string;
        countryCode: string;
        dial: string;
        localVoice: boolean;
        intlVoice: boolean;
        localText: boolean;
        intlText: boolean;
        localData: boolean;
        intlData: boolean;
        landline: boolean;

        /** to be populateed by backend */
        userPhone?: JetUserPhoneInstance;

        /** to be populateed by backend */
        travPhone?: JetTravelerPhoneInstance;

        /** to be populated by backend */
        phone?: JetPhoneInstance;
    }

    interface JetEmailRequest {
        ref?: string;
        email: string;
        verified: boolean;

        /** to be populated by backend */
        userEmail?: JetUserEmailInstance;

        /** to be populated by backend */
        travEmail?: JetTravelerEmailInstance;

        /** to be populated by backend */
        emailInstance?: JetEmailInstance;
    }

    interface JetViaBoundRequest {
        airportCode: string;
        terminalCode?: string;
        date: Date;
        time: string;
        /** To be completed by backend */
        airport?: JetAirportInstance;
        /** To be completed by backend */
        terminal?: JetTerminalInstance;
    }

    interface JetFlightRequest {
        airlineName?: string;
        airlineCode?: string;
        flightCode?: string;
        layoverOrdinal?: number;

        /** To be completed by backend */
        keyType?: JetAirlineKeyType;
        /** To be completed by backend */
        airline?: JetAirlineInstance;
        /** To be completed by backend */
        flight?: JetFlightInstance;
    }

    interface JetViaRequest {
        dep: JetViaBoundRequest;
        arr: JetViaBoundRequest;
        flight?: JetFlightRequest;
        travelers: Array<{
            ref: string, 
            volunteer: boolean,
            /** To be completed by backend */
            userTraveler?: JetUserTravelerInstance;
        }>;
        ordinal?: number;
        update?: JetViaChange;

        /** To be completed by backend */
        via?: JetViaInstance;

        /** Copy of the via BEFORE making change. 
         * 
         * Completed by backend only when viaRequest.update equals to "chg"*/
        prevVia?: JetViaInstance

        /** To be completed by backend (see via.updateFromRequest) */
        taskChg?: JetChangeType;
    }

    interface JetTripRequest {
        tripUser: {
            ref?: string;
            alias: string;
        },
        vias: Array<JetViaRequest>;

        /** To be completed by backend */
        trip?: JetTripInstance;

        /** To be completed by backend */
        delVias?: Array<JetViaInstance>;

        /** To be completed by backend */
        addVias?: Array<JetViaInstance>;

        /** Existing vias that won't be deleted after the update.
         * 
         * To be completed by backend */
        remainingVias?: Array<JetViaInstance>;

        /** Collection of resulting via instances after additions, updates, and deletions.
         * 
         * To be completed by backend */
        finalVias?: Array<JetViaInstance>;
    }

    interface JetCityStopRequest extends JetAddressRequest{
        marker: {
            userRef?: string;
            travelerRef?: string;
        },
        area: {
            neighborhoodName?: string;
            aggloName?: string;
        },
        /** To be populated by backend. */
        customAddress: boolean;
        /** To be populated by backend. */
        hood?: JetNeighborhoodInstance;
        /** To be populated by backend. */
        address?: JetAddressInstance;
    }

    interface JetRiderPreferences {
        ridePref: JetRiderPref;
        payPref: JetPayPref;
        smokePref: JetSmokePref;
        petPref: JetPetPref;
        curbPref: JetCurbPref;
    }

    interface JetRiderRideSpecs {
        createRide: boolean;
        rideType: JetRideType;
        public: boolean;
        /** To be populated by the backend */
        ride?: JetRideInstance;
    }

    interface JetRiderRequest {
        /** Result: to be populated by backend */
        rider?: JetRiderInstance;
        toward: JetRideWay;
        cityLocation: JetCityStopRequest;
        requirements: JetRiderUsageResponse;
        preferences: JetRiderPreferences;
        ride: JetRiderRideSpecs
    }

    interface JetRiderFromViaRequest extends JetRiderRequest {
        viaOrdinal: number;
        /** To be populated by the backend.*/
        refVia?: JetViaInstance;
        travelers: Array<{
            viaRef: string, 
            /** To be populated by backend */
            viaTraveler?: JetViaTravelerInstance
        }>;
    }

    interface JetRiderFullRequest extends JetRiderRequest {
        date: Date;
        startTime: string;
        airportLocation: {
           airportCode: string;
           terminalCode: string;
           /** To be populated by the backend.*/
           airport?: JetAirportInstance;
           /** To be populated by the backend.*/
           terminal?: JetTerminalInstance;         
        };
        travelers: Array<{
            userRef: string,
            userTraveler?: JetUserTravelerInstance
        }>;
    }

    interface JetRiderUpdateRequest extends JetRiderRequest {
        ref: string;
        /** To be populated by backend */
        riderUser?: JetRiderUserInstance;
        startTime: string;
        airportLocation:{
            airportCode: string;
            /** To be populated by backend */
            airport?: JetAirportInstance;
            terminalCode: string;
            /** To be populated by backend */
            terminal?: JetTerminalInstance;
        },
        fromVia: boolean;
        /** use neighborhood instead of location */
        useHoodOnly: boolean;
        travelers: Array<{
            userRef: string, 
            viaRef: string,
            userTraveler?: JetUserTravelerInstance;
            viaTraveler?: JetViaTravelerInstance;
        }>,
        /** To be populated by the backend if the rider is associated with a via.*/
        viaRef?: JetViaInstance;

        /** To be populated by the backend (populate method) */
        changeScore?: number;

        /** To be populated by the backend
         * 
         * Current ride of the rider, if any, which should include all related rideRider (members and applicants)*/
        currentRide?: JetRideInstance;

        /** To be populated by the backend
         * 
         * Suspended ride of the ride, if any*/
        suspendedRide?: JetRideInstance;

        /** To be populated by the backend
         * 
         * All pending applications, along with changeRequest and counter*/
        applications?: Array<JetRideRiderInstance>;
    }

    interface JetRideChangeRequest {
        /** To be populated by the backend */
        hasChange?: boolean;
        newDate: Date;
        newStartTime: string;
        terminalStopDrops: Array<string>;
        cityStopDrops: Array<string>;
        newTerminalStop?: {
            ordinal: number;
            terminalName: string;
            terminalCode: string;
        },
        newCityStop?: {
            ordinal: number;
            neighborhoodName: string;
        },
        newRequirements: JetRiderUsageResponse;
        newPolicies: JetRidePolicyResponse;
        closeRide: boolean;        
    }

    interface JetMessageRequest {
        dateTime: string;
        content: string;
    }

    interface JetBaseTaskRequest {
        type: JetTaskType;
        preferences: {
            publicTask: boolean;
        }
        depCityLocation?: JetCityStopRequest;
        arrCityLocation?: JetCityStopRequest;

        /** To be populated by the backend */
        task?: JetTaskInstance;
    }

    interface JetProvisionalAirportRequest{
        airportCode: string;
        /** To be populated by the backend */
        airport?: JetAirportInstance;
        /** To be populated by the backend */
        hood?: JetNeighborhoodInstance;
    }

    interface JetProvisionalTaskRequest extends JetBaseTaskRequest{
        earliestDate: Date;
        latestDate: Date;
        earliestTime: string;
        latestTime: string;
        /** front-end requests should just be the user_traveler_id, backend will create the object*/
        beneficiaries: Array<{userRef: string; userTraveler?: JetUserTravelerInstance}>;
        /** front-end requests should just be the IATA code, backend will create the object */
        depAirports: Array<JetProvisionalAirportRequest>;
        /** front-end requests should just be the IATA code, backend will create the object */
        arrAirports: Array<JetProvisionalAirportRequest>;
        flights: Array<JetFlightRequest>;
    }

    interface JetTaskRequestFromVia extends JetBaseTaskRequest {
        tripUser: string;
        /** Not applicable for update requests */
        viaOrdinal: number; 
        /** front-end requests should just be the via-traveler-id, backend will create the object*/
        members: Array<{viaRef: string; viaTraveler?: JetViaTravelerInstance}>;

        /** To be populated by the backend */
        trip?: JetTripInstance;

        /** To be populated by the backend */
        via?: JetViaInstance;
    }

    interface JetTaskUpdateMixin{
        /** task_user_id */
        userRef: string;

        /** To be populated by the backend */
        taskUser?: JetTaskUserInstance;

        /** To be populated by the backend */
        viaTask?: boolean;

        /** To be populated by the backend */
        changeType?: JetChangeType;
    }

    interface JetProvisionalTaskUpdateRequest extends JetProvisionalTaskRequest, JetTaskUpdateMixin {}
    interface JetFromViaTaskUpdateRequest extends JetTaskRequestFromVia, JetTaskUpdateMixin {
        startTime: string;
        endTime: string;
    }

    interface JetMemberRequest {
      /** task_via_traveler_id */
      ref: string;
      status: JetHelpStatus;
      rank?: number;
      /** To be populated by the backend */
      member?: JetTaskViaTravelerInstance;
    }

    interface JetTaskLinkRequest {
        /** task_user_id */
        taskRef: string;
        /** trip_user_id */
        tripRef: string;
        viaOrdinal: number;
        /** to be populated by the backend */
        task?: JetTaskInstance;
        /** to be populated by the backend */
        via?: JetViaInstance;
    }

    // RESPONSES ------------------------------------------------------------
    //-----------------------------------------------------------------------

    /** Geocoder address details from latitude and longitude parameters*/
    interface JetGeocoderAddressResponse {
        streetNumber: string;
        streetName: string;
        cityName: string;
        countryCode: string;
        /** Geocoder 'administrativeLevels.level1short' */
        stateCode: string;
        /** Geocoder 'administrativeLevels.level2short' */
        countyCode: string;
        zipcode: string;
        /** Geocoder 'extra.googlePlaceId' */
        locator: string;
        provider: string;
        /** Geocoder 'extra.neighborhood' */
        hoodHint: string;
    }

    /** JSON-type object containing private information about the user, 
     * to be displayed by the front end in forms.*/
    interface JetUserPrivateResponse{
        id: string,
        token: string
    }

    interface JetUserProfileResponse {
        profile: {
            name: string;
            email: string;
        },
        travelersCount: number;
        addressesCount: number;
        phonesCount: number;
        emailsCount: number;
        
        travelers: Array<JetTravelerListResponse>;
        addresses: Array<JetAddressSelectionResponse>;
        phones: Array<JetPhoneFullResponse>;
        emails: Array<JetEmailFullResponse>;
    }

    interface JetUserTravelerResponse {
        ref: string;
        primary: boolean;
        nickname: string;
        relation: JetUserTravelerRelation;
        status: JetUserTravelerStatus;
    }

    interface JetTravelerSelectionResponse{
        userTraveler: JetUserTravelerResponse
        profile: {
            ageBracket: JetTravelerAgeBrackets,
            gender: JetTravelerGender,
            pic: number
        }
    }

    interface JetTravelerListResponse extends JetUserTravelerResponse {
        ordinal: number;
        pic: number;
    }

    interface JetTravelerResponse {
        userRef?: string;
        viaRef?: string;
        riderRef?: string;
        publicName: string;
        ageBracket: JetTravelerAgeBrackets;
        gender: JetTravelerGender;
        relation: JetUserTravelerRelation;
        pic: number;
    }

    interface JetAddressFullResponse {
        location: {
            latitude: number;
            longitude: number;
            locator: string;
            provider: string;
        },
        details: {
            streetName: string;
            streetNumber: string;
            cityName: string;
            stateName: string;
            stateCode: string;
            countryName: string;
            countryCode: string;
        },
        infos: {
            buildingName: string;
            apartmentIdentifier: string;
            floorIdentifier: string;
            postcode: string;
            buildingDescription: string;
            accessDescription: string;
        }
    }

    interface JetAddressSelectionResponse extends JetAddressFullResponse{
        marker: {
            userRef?: string;
            travelerRef?: string;
            /** reference to the user-traveler when onlu a travelerRef */
            userTravelerRef?: string;
            alias: string;
            type: JetAddressType;
        }
    }

    interface JetPhoneFullResponse {
        /** may be user_phone_id or traveler_phone_id */
        ref: string;
        alias: string;
        countryCode: string;
        countryName: string;
        countryFlag: string;
        ext: string;
        dial: string;
        localText: boolean;
        intlText: boolean;
        localVoice: boolean;
        intlVoice: boolean;
        localData: boolean;
        intlData: boolean;
        landline: boolean;
    }

    interface JetEmailFullResponse {
        /** may be user_email_id or traveler_email_id */
        ref: string;
        email: string;
        verified: boolean;
    }

    interface JetTravelerProfileResponse {
        profile: {
            email: string;
            firstName: string;
            lastName: string;
            middleName: string;
            dob: string;
            publicName: string;
            ageBracket: JetTravelerAgeBrackets;
            pic: number;
        },

        addressCount: number;
        phoneCount: number;
        emailCount: number;

        addresses: Array<JetAddressSelectionResponse>;
        phones: Array<JetPhoneFullResponse>;
        emails: Array<JetEmailFullResponse>;
    }

    interface JetTripResponse {
        userTrip: {
            ref: string;
            alias: string;
        },
        summary: {
            type: JetTripType;
        }
        viasCount: number;
        vias: Array<JetViaResponse>;
    }

    interface JetAirportLocationResponse {
        airportCode: string;
        airportName: string;
        terminalCode: string;
        termninalName: string;
    }

    interface JetFlightResponse {
        airlineIata: string;
        airlineIcao: string;
        airlineName: string;
        flightCode: string;
    }

    interface JetViaFlightResponse extends JetFlightResponse {
        legOrdinal: number;
    }

    interface JetViaBound extends JetAirportLocationResponse {
        date: Date;
        time: string;
        /** only in via response, not when describing tasker via */
        airportCountryCode?: string;
        /** only in via response, not when describing tasker vioa */
        airportCountryName?: string;
        /** only in via response, not when describing tasker vioa */
        airportCountryFlag?: string;
    }

    interface JetViaTravelerResponse extends JetTravelerResponse {
        volunteer: boolean;
        bookingStatus: JetBookingStatus;
        ordinal: number;
    }

    interface JetViaResponse {
        ordinal: number;
        dep: JetViaBound;
        arr: JetViaBound;
        flight: JetViaFlightResponse;
        travelers: Array<JetViaTravelerResponse>
    }

    interface JetCityLocationResponse extends JetAddressSelectionResponse {
        area: {
            aggloName: string;
            neighborhoodName: string;
        }
    }

    interface JetRiderUsageResponse {
        seatCount: number;
        luggageCount: number;
        babySeatCount: number;
        sportEquipCount: number;
    }

    interface JetCurrentRideResponse {
        riderRef: string;
        rideType: JetRideType;
        rideStatus: JetRideStatus;
        riderStatus: JetRiderStatus;
    }

    interface JetPrivateRiderResponse {
        userRef: string;
        date: Date;
        startTime: string;
        toward: JetRideWay;
        pref: JetRiderPref;
        travelers: Array<JetTravelerResponse>;
        airportLocation: JetAirportLocationResponse;
        cityLocation: JetCityLocationResponse;
        requirements: JetRiderUsageResponse;
        currentRide: JetCurrentRideResponse;

        tripRef?: string;
        viaOrdinal?: number;
    }

    interface JetPotentialRiderResponse {
        tripRef: string;
        viaOrdinal: number;
        date: Date;
        startTime: string;
        toward: JetRideWay;
        airportLocation: JetAirportLocationResponse;
        travelers: Array<JetTravelerResponse>;
        requirements: {
            seatCount: number;
            luggageCount: number;
        }
    }

    // Ride components responses --------------------
    interface JetRidePolicyResponse {
        payMethod: JetPayPref;
        smokePolicy: JetSmokePref;
        petPolicy: JetPetPref;
        curbPolicy: JetCurbPref;
    }

    interface JetCostResponse {
        currency: string;
        val: number;
        upper: number;
        lower: number;
    }
    

    // Rider responses -----------------------------
    interface JetRideOwnerResponse {
        publicName: string;
        pic: number;
        coRiderCount: number;
        usage: JetRiderUsageResponse;
    }

    interface JetRideRiderResponse {
        ref: string;
        date: Date;
        startTime: string;
        terminalCode: string;
        terminalName: string;
        status: JetRiderStatus;
        neighborhoodName: string;
        travelers: Array<JetTravelerResponse>;
        usage: JetRiderUsageResponse;        
    }

    interface JetCurrentRideRiderResponse extends JetRideRiderResponse {
        ordinal: number;
    }

    interface JetApplicantResponse extends JetRideRiderResponse {
        rideRef: string;
    }


    // Ride responses ------------------------------
    interface JetRideBaseResponse {
        ref: string;
        date: Date;
        startTime: string;
        type: JetRideType;
        toward: JetRideWay;
        slots: JetRiderUsageResponse;
        riderCount: number;
        airport: {
            airportName: string;
            airportCode: string;
        };
        agglo: {
            aggloName: string;
        };
        airportStops: Array<{
            terminalCode: string,
            terminalName: string,
            ordinal: number,
            riderRef?: string
        }>;
        cityStops: Array<{
            neighborhoodName: string,
            ordinal: number,
            riderRef?: string
        }>;
        policies: JetRidePolicyResponse;

        /** rider status of the associated ride-rider instance */
        querierStatus?: JetRiderStatus;
        /** ride-rider id of the filtering rider*/
        querierRef?: string;
        /** rider-user id of the filtering rider - used in the frontend */
        userRef?: string;

    }

    interface JetRideSelectResponse extends JetRideBaseResponse{
        owner: JetRideOwnerResponse;
        matchPercentile: number;
    }

    interface JetRidePublicResponse extends JetRideBaseResponse {
        riders: Array<JetCurrentRideRiderResponse>;
        cost: JetCostResponse;
    }


    // Ride change responses -----------------------
    interface JetRideChangeResponse extends JetRideChangeRequest{
        // nothing for now
    }


    // Convo responses -----------------------------    
    interface JetMessageResponse {
        authorName: string;
        tmStp?: Moment;
        timeStamp: Date;
        content: string;
    }

    interface JetRideMessageResponse extends JetMessageResponse {
        /** ride_rider_id */
        ref: string;
    }

    interface JetTaskerMessageResponse extends JetMessageResponse {
        /** task_via_traveler_id */
        memberRef: string;
        /** task_traveler_id */
        beneficiaryRef: string;
    }


    // Tasks responses -----------------------------
    interface JetProvisionalTaskBound{
        airportCode: string;
        airportName: string;
        boundNeighborhood: string;
        boundAgglo: string;
    }

    interface JetTaskBound extends JetProvisionalTaskBound{
        date: Date;
        time: string;
    }

    interface JetTaskMemberResponse extends JetTravelerResponse{
        taskRef: string;
        status: JetHelpStatus;
        rank: number;

        /** Only populated in 'tasker' responses (routes: volunteers, helpers) */
        dep?: JetViaBound,
        /** Only populated in 'tasker' responses (routes: volunteers, helpers) */
        arr?: JetViaBound,
        /** Only populated in 'tasker' responses (routes: volunteers, helpers) */
        flight?: JetFlightResponse
    }

    interface JetBeneficiaryResponse extends JetTravelerResponse{
        beneficiaryRef: string;
    }

    interface JetTaskResponse {
        /** user-task id */
        userRef: string;
        /** task-via-traveler id of the 1st helpee */
        viaRef: string;

        type: JetTaskType;
        status: JetTaskStatus;
        ordinal: number;

        dep: JetTaskBound;
        arr: JetTaskBound;
        flight: JetFlightResponse;
        members: Array<JetTaskMemberResponse>;
    }

    interface JetPotentialTaskResponse {
        tripRef: string;
        viaOrdinal: number;
        dep: JetTaskBound;
        arr: JetTaskBound;
        flight: JetFlightResponse;
        passengers: Array<JetViaTravelerResponse>;
    }

    interface JetProvisionalTaskResponse {
        /** user-task id */
        userRef: string;
        /** task-traveler id of the 1st beneficiary */
        travRef: string;

        type: JetTaskType;
        status: JetTaskStatus;

        earliestDate: Date;
        latestDate: Date;
        earliestTime: string;
        latestTime: string;

        beneficiaries: Array<JetBeneficiaryResponse>;
        members?: Array<JetTaskMemberResponse>;

        /** not populated for find responses - use .dep*/
        depAirports?: Array<JetProvisionalTaskBound>;
        /** not populated for find responses -  use .arr*/
        arrAirports?: Array<JetProvisionalTaskBound>;
        /** Not populated for find responses - use .flight*/
        flights?: Array<JetFlightResponse>;
    }

    interface JetPrivateTaskMixin {
        depLocation?: JetCityLocationResponse;
        arrLocation?: JetCityLocationResponse;
    }

    interface JetPrivateTaskResponse extends JetTaskResponse, JetPrivateTaskMixin {
        tripRef: string;
        viaOrdinal: number;
    }
    interface JetPrivateProvisionalTaskReponse extends JetProvisionalTaskRequest, JetPrivateTaskMixin {}

    interface JetQuerierTaskMixin {
        querierStatus: JetHelpStatus;
        querierRef: string;
    }

    interface JetViaTaskFindResponse extends JetTaskResponse, JetQuerierTaskMixin {}
    interface JetProvisionalTaskFindResponse extends JetProvisionalTaskResponse, JetQuerierTaskMixin {
        dep: JetProvisionalTaskBound;
        arr: JetProvisionalTaskBound;
        flight: JetFlightResponse;
    }


    interface JetPassengerViaResponse {
        dep: JetViaBound,
        arr: JetViaBound,
        flight: JetFlightResponse
    }

    interface JetPassengerResponse extends JetPassengerViaResponse{
        passenger: JetViaTravelerResponse
    }

    interface JetNonTaskerResponse extends JetPassengerViaResponse{
        nonTasker: JetTaskMemberResponse
    }

    interface JetTaskNoticeResponse {
        memberRef: string;
        taskRef: string;
        noticeRef: string;
        type: JetTaskNoticeType;
        subType: JetTaskNoticeSubType;
        ownTask: boolean;
        timeStamp: string;
        notifier?: string;
    }

    interface JetAllNoticeResponse {
        taskNotices: JetTaskNoticeResponse[]
    }


    
    // MODEL TYPES ------------------------------------------------------------
    //
    // Defines <name>Attributes, <name>methods, <name>instance and <name>model
    // interfaces for each model in the database. Prefixes Jet- to <name> to
    // minimize namespace collision 
    //
    // ------------------------------------------------------------------------
    
    /** Provides intellisense for the db object in the global namespace by listing all
     * the models accessible.
     * 
     * To use, add a JSdoc with a snippet refering to this @type on the require
     * statement of the module.*/
    interface JetModels {
        Address: JetAddressModel;
        AddressInfo: JetAddressInfoModel;
        Agglo: JetAggloModel;
        Airline: JetAirlineModel;
        Airport: JetAirportModel;
        City: JetCityModel;
        Convo: JetConvoModel;
        Country: JetCountryModel;
        Currency: JetCurrencyModel;
        Email: JetEmailModel;
        Flight: JetFlightModel;
        Language: JetLanguageModel;
        Layover: JetLayoverModel;
        Message: JetMessageModel;
        Neighborhood: JetNeighborhoodModel;
        Phone: JetPhoneModel;
        State: JetStateModel;
        Ride: JetRideModel;
        Rider: JetRiderModel;
        Task: JetTaskModel;
        TaskNotice: JetTaskNoticeModel;
        Terminal: JetTerminalModel;
        Traveler: JetTravelerModel;
        Trip: JetTripModel;
        User: JetUserModel;
        Via: JetViaModel;


        MessagesUsers: JetMessageUserModel;
        NeighborhoodDrop: JetNeighborhoodDropModel;
        RidesNeighborhoods: JetRideNeighborhoodModel;
        RidesRiders: JetRideRiderModel;
        RideRiderRequest: JetRideRiderRequestModel;
        RidesTerminals: JetRideTerminalModel;
        RidersTravelers: JetRiderTravelerModel;
        RidersUsers: JetRiderUserModel;
        TasksAirports: JetTaskAirportModel;
        TasksFlights: JetTaskFlightModel;
        TasksTravelers: JetTaskTravelerModel;
        TasksUsers: JetTaskUserModel;
        TasksViasTravelers: JetTaskViaTravelerModel;
        TerminalDrop: JetTerminalDropModel;
        TravelersAddresses: JetTravelerAddressModel;
        TravelersPhones: JetTravelerPhoneModel;
        TravelersEmails: JetTravelerEmailModel;
        TripsUsers: JetTripUserModel;
        UsersAddresses: JetUserAddressModel;
        UsersTravelers: JetUserTravelerModel;
        UsersEmails: JetUserEmailModel;
        UsersPhones: JetUserPhoneModel;
        UserTaskNotice: JetUserTaskNoticeModel;
        ViasTravelers: JetViaTravelerModel;

        handlers: {
            fetch: JetFetchHandler;
            convo: JetConvoHandler;
            ride: JetRideHandler;
            task: JetTaskHandler;
            trip: JetTripHandler;
            notice: JetNoticeHandler;
            TaskAssembly: JetTaskAssemblyClass;
        },

        inputs: {
            rider: JetRiderInputManager;
            trip: JetTripInputManager;
            task: JetTaskInputManager;
        },

        sequelize: Sequelize;
        Sequelize: SequelizeStatic;
        queries: JetQueries;
    }


    // USER -------------------------------------------------------------------
    /** Attributes of instances of @type {JetUserInstance}*/
    interface JetUserAttributes{
        id: string;
        email: string;
        salt: string;
        iteration: number;
        public_name: string;
        hash: Buffer;
    }

    /**Instance methods of instances of @type {JetUserInstance}*/
    interface JetUserMethods{
        /** Async call to create or override the salt, iteration and hash attributes.
         * This doesn't persist the data in the database, you may need to call .save()*/
        setPassword(pwd: string): Promise<void>;

        /** Async call to validate the password sent by the front end
         * @return {Promise<boolean>} that resolves to true if the hash matches database entry*/
        validPassword(pwd: string): Promise<boolean>;

        /** Update, but does not persist, an user instance from the change requests
         * @return true if there are any changes*/
        updateFromRequest(userReq: JetUserRequest): boolean;

        /** Async call to generate a jwt to be returned by front end
         * @param riderId optional param that populates payload.riderId with the rider ref selected (used in rides/find)
         * @return a promise that resolves to the jwt representation*/
        createJwt(riderId?: string): Promise<string>;

        /** Async call to generate the JSON-like object to be returned to the front end.
         * This makes a call to @method JetUseMethods#generateJwt
         * @return a promise that resolves to the id of the user for fast lookup, and a jwt.*/
        createResponse(riderId? : string): Promise<JetUserPrivateResponse>;

        /** Sync call to generate the profile response, listing user associations with:
         * + travelers
         * + addresses
         * + phones
         * + emails*/
        createProfileResponse(): JetUserProfileResponse;

        // ASSOCIATION METHODS
        buildUserTraveler(traveler: JetTravelerInstance, userTravReq: JetUserTravelerRequest): JetUserTravelerInstance;
    }

    /** A user instance contains access credentials such as email and password and 
     * is associated to zero to many travelers. */
    interface JetUserInstance extends Instance<JetUserAttributes>, JetUserAttributes, JetUserMethods{
        Travelers?: Array<JetTravelerInstance>;
        Addresses?: Array<JetAddressInstance>;
        Phones?: Array<JetPhoneInstance>;
        Emails?: Array<JetEmailInstance>;
        Trips?: Array<JetTripInstance>;

        UsersTravelers?: JetUserTravelerInstance;
        RidersUsers?: JetRiderUserInstance;
        TripsUsers?: JetTripUserInstance;

        TravelerLinks?: Array<JetUserTravelerInstance>;
    }

    interface JetUserModel extends Model<JetUserInstance,JetUserAttributes>{
        isValidRequest(userReq: JetUserRequest, errors: JetErrors): boolean;
    }

    // ------------------------------------------------------------------------


    // TRAVELER ---------------------------------------------------------------
    interface JetTravelerAttributes {
        id: string,
        email: string,
        first_name: string,
        middle_name: string,
        last_name: string,
        dob: Date,
        public_name: string,
        age_bracket: JetTravelerAgeBrackets,
        gender: JetTravelerGender
        pic: number;
    }

    interface JetTravelerMethods {
        /** Requires fields Addresses, Phones and Emails fields populated, and address populated with AddressInfo field*/
        createProfileResponse(): JetTravelerProfileResponse;

        /** Requires fields UsersTravelers to be populated*/
        createUserListResponse(): JetTravelerListResponse;

        /** Requires fields ViasTravelers and possibly UsersTravelers populated */
        createViaResponse(ordinal?: number): JetViaTravelerResponse;

        /** Requires fields RidersTravelers populated */
        createRiderResponse(
            travMap?: {[travId: string]: JetUserTravelerInstance},
            via?: JetViaInstance
        ): JetTravelerResponse;

        /** Requires field TasksTravelers to be populated */
        createBeneficiaryResponse(travMap: {[travId: string]: JetUserTravelerInstance}): JetBeneficiaryResponse;

        /** Requires field TasksViasTravelers to be populated */
        createTaskMemberResponse(
            travMap?: {[travId: string]: JetUserTravelerInstance},
            private?: boolean
        ): JetTaskMemberResponse;

        /** Update, but does not persist, a traveler instance from the change requests
         * @return true if there are any changes*/
        updateFromRequest(travReq: JetTravelerRequest): boolean;
    }

    /** A traveler instance contains details of an actual person, such first and last name,
     * and is associated with one to many user, and to only one primary user. 
     * 
     * Trips and Rides are composed of travelers.*/
    interface JetTravelerInstance extends Instance<JetTravelerAttributes>, JetTravelerAttributes, JetTravelerMethods{
      Users?: Array<JetUserInstance>;
      Addresses?: Array<JetAddressInstance>;
      Phones?: Array<JetPhoneInstance>;
      Emails?: Array<JetEmailInstance>;

      UsersTravelers?: JetUserTravelerInstance;
      ViasTravelers?: JetViaTravelerInstance;
      RidersTravelers?: JetRiderTravelerInstance;
      TasksTravelers?: JetTaskTravelerInstance;
      TasksViasTravelers?: JetTaskViaTravelerInstance;
    }

    interface JetTravelerModel extends Model<JetTravelerInstance,JetTravelerAttributes>{
        isValidRequest(travReq: JetTravelerRequest, errors: JetErrors): boolean;
        buildFromRequest(travReq: JetTravelerRequest): JetTravelerInstance;

        createMap(travIds: Array<string>): Promise<{[travId: string]: JetTravelerInstance}>;
    }



    // LANGUAGE ---------------------------------------------------------------
    interface JetLanguageAttributes {
        /** Two-to-three IANA letter code. e.g. 'en' or 'fr' - used as primary key*/
        subtag: String;
        /** Language description per IANA. e.g. 'english' or 'french' */
        name: String;
        pic?: Number;
    }

    interface JetLanguageMethods {
        // nothing for now
    }

    interface JetLanguageInstance extends Instance<JetLanguageAttributes>, JetLanguageAttributes, JetLanguageMethods{}

    interface JetLanguageModel extends Model<JetLanguageInstance, JetLanguageAttributes>{}
    // ------------------------------------------------------------------------


    // CURRENCY ---------------------------------------------------------------
    interface JetCurrencyAttributes {
        code: string;
        name: string;
    }

    interface JetCurrencyMethods {
        // nothing for now
    }

    interface JetCurrencyInstance extends Instance<JetCurrencyAttributes>, JetCurrencyAttributes, JetCurrencyMethods{}

    interface JetCurrencyModel extends Model<JetCurrencyInstance, JetCurrencyAttributes>{}
    // ------------------------------------------------------------------------


    // COUNTRY ----------------------------------------------------------------
    interface JetCountryAttributes {
        code?: Number;
        /** Name of the country in language='en' */
        name: string;

        /** Region associated with the country.
         * 
         * One of 'AF','AN','AS','EU','NA','OC' or 'SA'
         */
        region: string;
        /** Name of the country in the most common local language */
        local_name: string;
        /** Phone extension of the country */
        phone: string;
        flag_emoji: string;
        hasStates: boolean;
        stateTitle?: string;
        pic?: number;
    }

    interface JetCountryMethods {
        // nothing for now
    }

    interface JetCountryInstance extends Instance<JetCountryAttributes>, JetCountryAttributes, JetCountryMethods{}

    interface JetCountryModel extends Model<JetCountryInstance,JetCountryAttributes>{}
    // ------------------------------------------------------------------------


    // STATE ------------------------------------------------------------------
    interface JetStateAttributes {
        id?: Number;
        /** Name of the state - or other administrative subdivision - in language='en' */
        name: String;
        /** Name of the state - or other administrative subdivision -  in the most common local language */
        local_name: String;
        /** Common code of the state - or other administrative subdivision - usually 2 to 5 letters */
        code: string;
        pic?: Number;
        /** Two-letter code of the country */
        country_id: string;
    }

    interface JetStateMethods {
        // nothing for now
    }

    interface JetStateInstance extends Instance<JetStateAttributes>, JetStateAttributes, JetStateMethods{}

    interface JetStateModel extends Model<JetStateInstance,JetStateAttributes>{
        /** Convert google 'state' reading (admin_level_1) to entries of
         * db table 'States'.
         * 
         * Currently used for GB regions only*/
        readStateCode(code: string): string;
    }
    // ------------------------------------------------------------------------


    // CITY -------------------------------------------------------------------
    interface JetCityAttributes {
        id: number;
        /** Name of the city or township in language='en' */
        name: string;
        /** Name of the agglo that uses this city or township as center in language = 'en' */
        agglo_name: string;
        /** Name of the agglo that uses this city or township as center in the most common local language */
        agglo_local_name: string;
        latitude: number;
        longitude: number;
        population: number;
        suburban: boolean;
        /** Code of the special city the agglo is part of: only one special zone max per city*/
        zone: string;
        pic?: number;
    }

    interface JetCityMethods {
        // nothing for now
    }

    interface JetCityInstance extends Instance<JetCityAttributes>, JetCityAttributes, JetCityMethods{
        SubHoods?: Array<JetNeighborhoodInstance>;
        Suburbs?: Array<JetNeighborhoodInstance>;
    }

    interface JetCityModel extends Model<JetCityInstance,JetCityAttributes>{
        createLookupName(string): string;
        createFromGeocode(
            countryCode: string,
            lat: number,
            lng: number,
            geocode: JetGeocoderAddressResponse
        ): Promise<JetCityInstance>;
    }
    // ------------------------------------------------------------------------


    // AGGLO ------------------------------------------------------------------
    interface JetAggloAttributes {
        id: number;
        /** Name of the agglomeration in language='en' */
        name: string;
        /** Name of the agglomeration in the most common local language */
        local_name?: string;
        latitude: number;
        longitude: number;
        population: number;
        multi_country: boolean
        pic?: number;
    }

    interface JetAggloMethods {
        // nothing for now
    }

    interface JetAggloInstance extends Instance<JetAggloAttributes>, JetAggloAttributes, JetAggloMethods{
        PrimaryCity?: JetCityInstance;
        PrimaryState?: JetStateInstance;
        PrimaryCountry?: JetCountryInstance;
        Neighborhoods?: Array<JetNeighborhoodInstance>;

        Countries?: Array<JetCountryInstance>;
    }

    interface JetAggloModel extends Model<JetAggloInstance,JetAggloAttributes>{
        createMap(aggloIds: Array<string>): Promise<{[aggloId: number]: JetAggloInstance}>;
        createAggloMap(aggloNames: Array<string>): Promise<{[aggloName: string]: Array<JetAggloInstance>}>;
        addCityAgglos(cityId: string, aggloIds: string[]): Promise<void>;
    }
    // ------------------------------------------------------------------------


    // NEIGHBORHOOD -----------------------------------------------------------
    interface JetNeighborhoodAttributes {
        id: number;
        /** Name of the neighborhood in language='en' */
        name: string;
        /** Name of the neighborhood in the most common local language */
        local_name?: string;
        /** Details of the commonly used neighborhoods that this neighborhood encompasses */
        description?: string;
        latitude: number;
        longitude: number;
        /** Distance (in kilometers) from the agglo city center */
        distance: number;
        /** Weight multiplier of the neighborhood. Default=1, i.e. only weighted by population.
         * + used to generate random addresses and ride locations.
         * + use higher multipliers for touristic or business-intensive neighborhoods.*/ 
        weight: number;
        agglo_id: number;
        default_city: number;
    }

    interface JetNeighborhoodMethods {
        // nothing for now
    }

    interface JetNeighborhoodInstance extends Instance<JetNeighborhoodAttributes>, JetNeighborhoodAttributes, JetNeighborhoodMethods{
        Agglo?: JetAggloInstance;
        DefaultCity?: JetCityInstance;
        Townships?: Array<JetCityInstance>;

        /** Accessible in the context of ride->CityStop[].RidesNeighborhoods */
        RidesNeighborhoods?: JetRideNeighborhoodInstance;
    }

    interface JetNeighborhoodModel extends Model<JetNeighborhoodInstance,JetNeighborhoodAttributes>{
        createHoodMap(hoodNames: Array<string>): Promise<{[hoodName: string]: Array<JetNeighborhoodInstance>}>;
        /** populates agglo as well*/
        createHoodIdMap(hoodIds: Array<string>): Promise<{[hoodId: string]: JetNeighborhoodInstance}>;
        addCityHoods(cityId: string, hoodIds: string[]): Promise<void>;
    }
    // ------------------------------------------------------------------------


    // AIRPORT ----------------------------------------------------------------
    interface JetAirportAttributes {
        /** IATA 3-letter code of the airport*/
        id: string;
        /** ICAO 4-letter code of the airport */
        icao?: string;
        /** Name of the airport in language='en' */
        name: string;
        /** Name of the neighborhood in the most common local language */
        local_name?: String;
        latitude: number;
        longitude: number;
    }

    interface JetAirportMethods {
        /** Use for provisional airport of a task - require .TasksAirports.Neighborhood field populated*/
        createProvisionalResponse(): JetProvisionalTaskBound;
    }

    interface JetAirportInstance extends Instance<JetAirportAttributes>, JetAirportAttributes, JetAirportMethods{
        Country?: JetCountryInstance;
        PrimaryAgglo?: JetAggloInstance;

        Agglos?: Array<JetAggloInstance>;
        Terminals?: Array<JetTerminalInstance>;

        TasksAirports?: JetTaskAirportInstance;
    }

    interface JetAirportModel extends Model<JetAirportInstance,JetAirportAttributes>{
        createAirportMap(iatas: Array<string>): Promise<{[iata: string]: JetAirportInstance}>;
        /** Creates a map of airports by iata, and populates the Agglos field for each of them.
         * + if an aggloIdMap is provided, will add all agglos associated to all these airports to the map aggloId->Agglo.*/
        createExtendedAirportMap(
            iatas: Array<string>,
            aggloIdMap?: {[aggloId: number]: JetAggloInstance}
        ): Promise<{[iata: string]: JetAirportInstance}>;
    }
    // ------------------------------------------------------------------------
    

    // TERMINAL ---------------------------------------------------------------
    interface JetTerminalAttributes {
        /** integer primary key: careful, zero is a valid entry */
        id: number;
        /** identifier of the terminal*/
        code: string;
        /** full name of the terminal - in most cases, same as 'code */
        name: string;
        local_name?: string;
        /** average time in minutes to get to the taxi line from the arrival gate of domestic flights*/
        domestic_time?: number;
        /** average time in minutes to get to the taxi line from the arrival gate of international flights */
        international_time?: number;
        airport_id: string;
    }

    interface JetTerminalMethods {
        // nothing for now
    }

    interface JetTerminalInstance extends Instance<JetTerminalAttributes>, JetTerminalAttributes, JetTerminalMethods{
        /** Accessible in the context of ride->TerminalStops[].RidesTerminals */
        RidesTerminals?: JetRideTerminalInstance;
        Airport?: JetAirportInstance;
    }

    interface JetTerminalModel extends Model<JetTerminalInstance,JetTerminalAttributes>{
        createMap(terminalIds: Array<number>): Promise<{[terminalId: number]: JetTerminalInstance}>;
        createTerminalMap(keys: Array<string>): Promise<{[key: string]: JetTerminalInstance}>;
        createMapFromAirports(airportIds: Array<string>): Promise<{[terminalId: number]: JetTerminalInstance}>;
    }
    // ------------------------------------------------------------------------


    // ADDRESS ----------------------------------------------------------------
    interface JetAddressAttributes {
        id: string;
        street_name: string;
        street_number: string;
        latitude: number;
        longitude: number;
        locator: string;
        provider: string;
        country_id: string;
        state_id: number;
        city_id: number;
        address_info_id: string;
    }

    /** To be used within address functions only */
    type JetAddressHoodSearchEntry = {
        airport: JetAirportInstance;
        airportPos: {latitude: number, longitude: number};
        aggloEntries: Array<{val: number, agglo: JetAggloInstance}>;
        neighborhood: JetNeighborhoodInstance;
    };

    interface JetAddressMethods {
        setCity(city: JetCityInstance): Promise<void>;
        getCity(): Promise<JetCityInstance>;
        setState(state: JetStateInstance): Promise<void>;
        getState(): Promise<JetStateInstance>;
        setCountry(country: JetCountryInstance): Promise<void>;
        getCountry(): Promise<JetCountryInstance>;

        addUser(user: JetUserInstance, alias?: string, type?: JetAddressType): Promise<JetUserAddressInstance>;
        addTraveler(traveler: JetTravelerInstance, alias?: string, type?: JetAddressType): Promise<JetTravelerAddressInstance>;

        /** Fetches countryCode, state_id and city_id for a city, but does not persist these changes */
        findCountryStateCity(details: {countryCode: string, stateCode: string, cityName: string}): Promise<JetAddressInstance>;
        
        /** Fetches the best fit neighborhood for potential rides or tasks given an airport.    
         * + (1) uses the agglos associated to an airport, and order them to minimize the expression:
         * val = [ distance(address-agglo)^2 + distance(airport-agglo)^2 ]
         * + (2) fetches all the neighborhoods that are 
         * (i) associated with the city of the address
         * (ii) of an agglo associated with the airport
         * + (3) starting from the agglo of the lowest val to highest, finds the closest neighborhood to
         * the address associated to the city.
         * 
         * @param airport instance with an include 'Agglos' statement such that airport.Agglos is available.*/
        findNeighborhood(airport: JetAirportInstance): Promise<JetNeighborhoodInstance>;

        /** Fetches the best fit neighborhood for potential rides given an agglo.
         * + (1) fetches all the neighborhoods that are 
         * (i) associated with the city of the address
         * (ii) associated with the provided agglo
         * + (2) finds the closest neighborhood to the address position
         * @param agglo */
        findNeighborhoodWithinAgglo(aggloId: string): Promise<JetNeighborhoodInstance>;

        /** Fetches the best fit neighborhood for provisional tasks given to be associated with each airport
         * + (1) uses the agglos associated to each airports, and order them to minimize the expression:
         * val = [ distance(address-agglo)^2 + distance(airport-agglo)^2 ]
         * + (2) fetches all the neighborhoods that are 
         * (i) associated with the city of the address
         * (ii) of an agglo associated with at least one airport
         * + (3) starting from the agglo of the lowest val to highest, finds the closest neighborhood to
         * the address associated to the city for each airport
         * 
         * @param airports  instance with an include 'Agglos' statement such that airport.Agglos is available*/
        createNeighborhoodMap(airports: Array<JetAirportInstance>): Promise<{[airportIata: string]: JetNeighborhoodInstance}>;

        /** Update an address, but does not persist the changes - does not handle addressInfo either.
         * @param fields from the request
         * @return {boolean} TRUE if the addressRequest is valid and the address instance was modified*/
        updateFromFields(fields: JetAddressRequest): boolean;

        /** Update and persist an already existing address entry.
         * 
         * If necessary, will update/build and save the addressInfo entry.*/
        updateAndSaveFromFields(addressReq: JetAddressRequest): Promise<void>;

        /** To be used whenever an address is returned to the creator or associated user */
        createFullResponse(): JetAddressFullResponse;

        /** To be used for selection of an address when creating / updating riders */
        createSelectionResponse(
            userAddrs: JetUserAddressInstance, 
            travAddrs: JetTravelerAddressInstance
        ): JetAddressSelectionResponse;
    }

    interface JetAddressInstance extends Instance<JetAddressAttributes>, JetAddressAttributes, JetAddressMethods{
        AddressInfo?: JetAddressInfoInstance;
        City?: JetCityInstance;
        State?: JetStateInstance;
        Country?: JetCountryInstance;

        UsersAddresses?: JetUserAddressInstance;       
        TravelersAddresses?: JetTravelerAddressInstance;
    }

    interface JetAddressModel extends Model<JetAddressInstance,JetAddressAttributes>{
        isValidRequest(addressReq: JetReferencedAddressRequest, errors: JetErrors, ind?: number, checkLonLat?: boolean): boolean;
        isValidEdit(addressReq: JetReferencedAddressRequest, errors: JetErrors, ind?: number): boolean;
        
        /** In the context of a rider or task request */
        isValidCityStopRequest(cityStopReq: JetCityStopRequest, errors: JetErrors, lbl: string, ind?: number): boolean;

        fetchGeocodeInfos(addressRequests: Array<JetAddressRequest>): Promise<Array<JetAddressRequest>>;
        /** Checks if the information provided is enough to create an address entry (lat and lon are required).
         * 
         * It will populates empty fields from geocoder using lat and lon if necessary. 
         * Also, it will add a .geolocated=true property*/
        updateRequestFields(fields: JetAddressRequest): Promise<JetAddressRequest>;
        shouldRemove(id: string): Promise<boolean>;
        unlinkFromUser(models: JetModels, userId: JetUserInstance, ids: Array<Buffer | string>, 
            addressIds: Array<Buffer | string>): Promise<Array<Buffer | string>>;
        
        /**@return TRUE if the type is a valid entry for UserAddress.type field*/
        isValidType(type: string): boolean;
        /**Creates, but does not persist, and address instance from the fields.*/
        buildFromFields(fields: JetAddressRequest): JetAddressInstance;

        /** Fetch address map whose instances are extended for city, state, country and address infos */
        createAddressIdMap(addressIds: Array<string>): Promise<{[addressId: string]: JetAddressInstance}>;

        /** Takes unlinked addresses (from riders or tasks) as input, then for each entry
         * + check if it is still associated to at least one user or a traveler
         * + if not, remove that entry from the database, otherwise do nothing */
        handleUnlinks(unlinkedAddressIds: {[addressId: string]: boolean}): Promise<void>;

        /** To be used in task.unlink to populate TaskAirport neighborhood_id field */
        findHood(addressId: string, airportId: string): Promise<JetNeighborhoodInstance>;

        createBlankSelectionResponse(): JetAddressSelectionResponse;
        createCityLocationResponse(
            address: JetAddressInstance,
            userAddress?: JetUserAddressInstance, 
            travAddress?: JetTravelerAddressInstance, 
            hood?: JetNeighborhoodInstance
        ): JetCityLocationResponse; 
    }
    // ------------------------------------------------------------------------

    
    // ADDRESS INFOS ----------------------------------------------------------
    interface JetAddressInfoAttributes {
        id: string;
        /** Some address reference a building name instead of a street number, typically in the UK */
        building_name?: string;
        apartment_identifier?: string;
        floor_identifier?: string;
        postcode?: string;
        building_description?: string;
        access_description?: string;
        /** Full name of the city in case it wasn't identified in the database */
        city?: string;
        /** Full name of the state in case it wasn't identified in the database */
        state?: string;
        address_id: Buffer;
    }

    interface JetAddressInfoMethods {}

    interface JetAddressInfoInstance extends Instance<JetAddressInfoAttributes>, JetAddressInfoAttributes, JetAddressInfoMethods{
        Address?: JetAddressInstance;
    }



    interface JetAddressInfoModel extends Model<JetAddressInfoInstance,JetAddressInfoAttributes>{
        /** Sync function returning an instance of AddressInfo. Need to persist and associate it to a User or Traveler.
         * @param info fields of the AddressInfo */
        buildFromFields(info: JetAddressInfoRequest,address_id?: string): JetAddressInfoInstance;
    }
    // ------------------------------------------------------------------------

    // PHONE ------------------------------------------------------------------
    interface JetPhoneAttributes {
        id: Buffer;
        country_id: string;
        dial: number;
        local_text: boolean;
        intl_text: boolean;
        local_voice: boolean;
        intl_voice: boolean;
        local_data: boolean;
        intl_data: boolean;
        landline: boolean;
    }

    interface JetPhoneMethods {
        addUser(user: JetUserInstance, alias?: string): Promise<JetUserPhoneInstance>;
        addTraveler(traveler: JetTravelerInstance, alias?: string): Promise<JetTravelerPhoneInstance>;

        saveInstance(countryCode: string): Promise<void>;
        updateFromFields(fields: JetPhoneRequest): void;

        /** Requires Country field to be populated
         * @param ref may be userPhone.id or travelerPhone.id
         * @param alias may be userPhone.alias or travelerPhone.alias*/
        createProfileResponse(ref: string, alias?: string): JetPhoneFullResponse;
    }

    interface JetPhoneInstance extends Instance<JetPhoneAttributes>, JetPhoneAttributes, JetPhoneMethods{
        TravelersPhones?: JetTravelerPhoneInstance;
        UsersPhones?: JetUserPhoneInstance;

        Country?: JetCountryInstance;
        Address?: JetAddressInstance;
    }

    interface JetPhoneModel extends Model<JetPhoneInstance,JetPhoneAttributes>{
        countUsersTravelers(id: string): Promise<[number]>;
        isValidRequest(phoneReq: JetPhoneRequest, errors: JetErrors, ind?: number): boolean;
        isValidEdit(phoneReq: JetPhoneRequest, errors: JetErrors, ind?: number): boolean;

        /** Sync function returning an instance of Phone. Need to persist and associate it to a User or Traveler.
         * @param info fields of the Phone entry*/
        buildFromFields(info: JetPhoneRequest): JetPhoneInstance;
    }
    // ------------------------------------------------------------------------

    // EMAIL ------------------------------------------------------------------
    interface JetEmailAttributes {
        id: Buffer;
        email: string;
        verified: boolean;
    }

    interface JetEmailMethods {
        addUser(user: JetUserInstance): Promise<void>;
        addTraveler(traveler: JetTravelerInstance): Promise<void>;

        updateFromFields(fields: JetEmailRequest): void;

        /** @param ref userEmail.id or travelerEmail.id */
        createProfileResponse(ref: string): JetEmailFullResponse;
        countUsersTravelers(): Promise<{userCount: number, travCount: number}>;
    }

    interface JetEmailInstance extends Instance<JetEmailAttributes>, JetEmailAttributes, JetEmailMethods{
        UsersEmails?: JetUserEmailInstance;
        TravelersEmails?: JetTravelerEmailInstance;
    }

    interface JetEmailModel extends Model<JetEmailInstance,JetEmailAttributes>{
        countUsersTravelers(id: string): Promise<number>;
        isValidRequest(email: string, errors: JetErrors, ind?: number): boolean;
        convertToRequests(emails: Array<string>): Array<JetEmailRequest>;
        isValidEdit(emailReq: JetEmailRequest, errors: JetErrors, ind?: number): boolean;

        buildFromFields(emailReq: JetEmailRequest): JetEmailInstance;
    }
    // ------------------------------------------------------------------------

    // AIRLINE ----------------------------------------------------------------
    interface JetAirlineAttributes {
        id: number;
        iata: string,
        icao: string,
        name: string,
        alt_name?: string,
        active: boolean,
        country_id: string
    }

    interface JetAirlineMethods {
        checkNameMatch(lookUp: string): boolean;
    }

    interface JetAirlineInstance extends Instance<JetAirlineAttributes>, JetAirlineAttributes, JetAirlineMethods{
        Country?: JetCountryInstance;
    }

    interface JetAirlineModel extends Model<JetAirlineInstance,JetAirlineAttributes>{
        createIdMap(ids: Array<number>): Promise<{[id: number]: JetAirlineInstance}>;
        createIataMap(iatas: Array<string>): Promise<{[iata: string]: JetAirlineInstance}>;
        createIcaoMap(icaos: Array<string>): Promise<{[icao: string]: JetAirlineInstance}>;
        pullByName(names: Array<string>): Promise<Array<JetAirlineInstance>>;    
    }
    // ------------------------------------------------------------------------

    // FLIGHT -----------------------------------------------------------------
    interface JetFlightAttributes {
        id: Buffer;
        code: string;
        version: number;
        dep_time: number;
        arr_time: number;
        day_diff: number;
        has_layover: boolean;
        operating: boolean;
        airline_id: number;
        dep_airport_id: string;
        dep_terminal_id: number;
        arr_airport_id: string;
        arr_terminal_id: number;
    }

    interface JetFlightMethods {}

    interface JetFlightInstance extends Instance<JetFlightAttributes>, JetFlightAttributes, JetFlightMethods{
        TasksFlights?: JetTaskFlightInstance;
        Airline?: JetAirlineInstance
    }

    interface JetFlightModel extends Model<JetFlightInstance,JetFlightAttributes>{
        createFlightMap(flightIds: Array<string>): Promise<{[flightId: string]: JetFlightInstance}>;
    }
    // ------------------------------------------------------------------------

    // LAYOVER ----------------------------------------------------------------
    interface JetLayoverAttributes {
        id: Buffer;
        ordinal: number;
        dep_time: number;
        arr_time: number;
        flight_id: Buffer;
        airport_id: string;
        dep_terminal_id: number;
        arr_terminal_id: number;
    }

    interface JetLayoverMethods {}

    interface JetLayoverInstance extends Instance<JetLayoverAttributes>, JetLayoverAttributes, JetLayoverMethods{}

    interface JetLayoverModel extends Model<JetLayoverInstance,JetLayoverAttributes>{
    }
    // ------------------------------------------------------------------------

    // TRIP -------------------------------------------------------------------
    interface JetTripAttributes {
        id: string;
        ordinal: number;
        type: JetTripType;
        creator_id: string;
        dep_agglo_id: number;
        arr_agglo_id: number;
    }

    interface JetTripMethods {
        compareTo(o: JetTripInstance);
        
        /** Requires fields vias populated */
        createResponse(
            userTrip: JetTripUserInstance,
            travUserTravMap?: {[travelerId: string]: JetUserTravelerInstance}
        ): JetTripResponse;
    }

    interface JetTripInstance extends Instance<JetTripAttributes>, JetTripAttributes, JetTripMethods{
        vias?: Array<JetViaInstance>;
        Users?: Array<JetUserInstance>;
        Creator?: JetUserInstance;
        TripsUsers?: JetTripUserInstance;

        UserLinks?: Array<JetTripUserInstance>;
    }

    interface JetTripModel extends Model<JetTripInstance,JetTripAttributes>{


        /** Utility to create a map of trips:
         * + giving access to the trip from the userTripId
         * + populated with the referring TripsUsers instance
         * + populated with trips */
        createTripUserMap(userTrips: Array<JetTripUserInstance>): Promise<{
            tripUserMap: {[userTripId: string]: JetTripInstance},
            airportIdMap: {[airportId: string]: JetAirportInstance},
            aggloIdMap: {[aggloId: number]: JetAggloInstance}
        }>;
            
    }
    // ------------------------------------------------------------------------

    // VIA --------------------------------------------------------------------
    interface JetViaAttributes {
        id: string;
        ordinal: number;
        dep_date: Date;
        arr_date: Date;
        dep_time: string;
        arr_time: string;
        trip_id: string;
        dep_airport_id: string;
        arr_airport_id: string;
        dep_terminal_id: number;
        arr_terminal_id: number;
        airline_id: number;
        flight_id: string;
    }

    interface JetViaMethods {
        compareByStartDateTime(o: JetViaInstance | JetViaAttributes): number;

        /** Checks whether the task is compatible with the via
         * + for provisionalTask, checks that the via matches the eligible arr / dep airports and time period
         * + for viaTask, checks that the via matches the arr / dep airport and flight match (if any)*/
        isCompatible(task: JetTaskInstance, errors: JetErrors, ind?: number): boolean;

        /** Following changes in the via, updates - but does not persist - the task:
         * + start_time 
         * + end_time
         * + flight_id 
         * 
         * @return type of change, either "breaking" or "minimal"*/
        updateTask(task: JetTaskInstance): JetChangeType;

        /**
         * @return TRUE only when:
         * + departure and arrival dates match
         * + departure airport and arrival airport match
         */
        matchesRequest(request: JetViaRequest): boolean;

        /** Populate the associated fields of the via: airports, terminals, airlines, flights */
        populate(fields: Array<string>, infos: JetInfos): JetViaInstance;

        /** Propagates the changes of a via to the riders and the tasks.
         * Can only involve change in time, terminal, airline and/or flight*/
        propagate(): Promise<void>;

        /** Requires DepAirport/ArrAirport/DepTerminal/ArrTerminal/Flight/Airline to be populated */
        createResponse(travIdUserTravMap: {[travId: string]: JetUserTravelerInstance}): JetViaResponse;

        /** Requires DepAirport/ArrAirport/DepTerminal/ArrTerminal/Flight/Airline to be populated */
        createBoundResponse(departure: boolean);

        /** Requires DepAirport/ArrAirport/DepTerminal/ArrTerminal/Flight/Airline to be populated */
        createPassengerViaResponse(): JetPassengerViaResponse;
        /** Requires Airline to be populated */
        assemblePassengerViaResponse(infos: JetInfos): JetPassengerViaResponse;

        /** Creates potential rider from via*/
        createPotentialRider(
            tripRef: string, 
            toCity: boolean, 
            travIdUserTravMap: {[travId: string]: JetUserTravelerInstance}
        ): JetPotentialRiderResponse;

        /** Create potential task from via */
        createPotentialTask(
            infos: JetInfos
        ): JetPotentialTaskResponse;
    }

    interface JetViaInstance extends Instance<JetViaAttributes>, JetViaAttributes, JetViaMethods{
        Trip?: JetTripInstance;
        Airline?: JetAirlineInstance;
        Flight?: JetFlightInstance;
        Layover?: JetLayoverInstance;
        DepAirport?: JetAirportInstance;
        ArrAirport?: JetAirportInstance;
        DepTerminal?: JetTerminalInstance;
        ArrTerminal?: JetTerminalInstance;

        Travelers?: Array<JetTravelerInstance>;

        TasksViasTravelers?: Array<JetTaskViaTravelerInstance>;
        ViasTravelers?: Array<JetViaTravelerInstance>;
        Riders?: Array<JetRiderInstance>;
    }

    interface JetViaModel extends Model<JetViaInstance,JetViaAttributes>{
        /** Creates map viaId -> viaInstance*/
        createViaMap(viaIds: Array<string>, extended?: boolean): Promise<{[viaId: string]: JetViaInstance}>;
    }
    // ------------------------------------------------------------------------


    // RIDE -------------------------------------------------------------------
    interface JetRideAttributes {
        id: string;
        date: Date;
        start_time: string;
        status: JetRideStatus;
        type: JetRideType;
        toward: JetRideWay;

        seat_count: number;
        luggage_count: number;
        baby_seat_count: number;
        sport_equip_count: number;

        seat_available: number;
        luggage_available: number;
        baby_seat_available: number;
        sport_equip_available: number;

        pay_method: JetPayPref;
        smoke_policy: JetSmokePref;
        pet_policy: JetPetPref;
        curb_policy: JetCurbPref;

        public: boolean;

        airport_id: string;
        agglo_id: number;
        creator_id: Buffer | string
    }

    interface JetRideMethods {
        getAvailableSeats(): number;
        getAvailableLuggages(): number;
        getAvailableBabySeats(): number;
        getAvailableSportEquip(): number;

        /** Requires fields Riders populated, themselves populated with fields Travelers */
        getTravelerIds(): Array<string>;

        /** Requires fields Riders populated */
        getRiderIds(): Array<string>;

        /** Requires fields Riders populated */
        getAdminRiderIds(): Array<string>;

        /** Requires fields Riders populated */
        getOwner(): JetRiderInstance;

        /** Requires fields Riders populated */
        getCoRiders(): Array<JetRiderInstance>;

        /** Requires fields Riders populated */
        countCoRiders(): number;

        /** Provides the active ride status (open or full) based on the ride params*/
        getActiveStatus(): JetRideStatus;

        /** Persists ride, then associates it with the rider on which it is based */
        saveInitial(rider: JetRiderInstance, suspend?: boolean, t?: JetTransaction): Promise<JetRideInstance>;

        /** Update, but does not persist, a ride from a rider, using the current rideRider associated with such ride.
         * 
         * Note that this function does not update the cityStops / terminalStops.
         * @param type if omitted or set to null, keep the current ride type
         * @param public if omitted or set to null, keep the current ride public setting*/
        updateFromRider(rider: JetRiderInstance, type?: JetRideType, public?: boolean): void;

        createBaseResponse(ref: string, provideInfo?: boolean, riderCount?: number): JetRideBaseResponse;
        
        createListResponse(
            filterRider: JetRiderInstance,
            filterRideRider: JetRideRiderInstance,
            errors: {[errorType: string]: string},
            userRef?: string
        ): JetRideSelectResponse;

        createPublicResponse(
            filterRider: JetRiderInstance, 
            ownRideRider: JetRideRiderInstance,
            errors: {[errorType: string]: string},
            travUserTravMap?: {[travelerId: string]: JetUserTravelerInstance},
            userRef?: string
        ): JetRidePublicResponse;

        estimateMatchPercentile(withRider: JetRiderInstance): number;
        listMatchFactors(withRider: JetRiderInstance): {percentile: number, factors: Array<{val: number, name: string}>}
        estimateCost(withRider?: JetRiderInstance): JetCostResponse;
        
        /** Update fields:
         * + seat_count, luggage_count, baby_seat_count, sport_equip_count
         * + available_seat, available_luggage, available_baby_seat, available_sport_equip
         * 
         * Requires the fields Riders, all []_count fields to be populated.
         * Does not persist the changes in the database*/
        updateUsage(closeRide?: boolean): void;

        allowSave(rideRider?: JetRideRiderInstance): boolean;

        /** Checks that the ride and rider are fundamentally compatible: 
         * + date/time are compatible (within 12 hours)
         * + same toward
         * + same airport
         * + same agglo
         * + no overlapping traveler*/
        mayAdmit(rider: JetRideRiderInstance): boolean;

        /** Checks that the requested changes make sense for the ride
         * + date/time are compatible (within 24 hours)
         * + will keep at least one hood stop
         * + new terminal (airport stop) is in the same agglo
         * + new hood (city stop) is in the same agglo*/
        mayAcceptChange(changeReq: JetRideRiderRequestInstance): boolean;

        /** Checks whether a rider can still be part of a ride, presumably after an update
         * + date/time are compatible (within 24 hours)
         * + same agglo
         * + same airport*/
        mayKeep(rider: JetRiderInstance): boolean;

        /** Adds a co-rider to the ride, update the ride per the change request*/
        admit(
          rideRider: JetRideRiderInstance,
          rider: JetRiderInstance,
          changeReq?: JetRideRiderRequestInstance,
          counter?: JetRideRiderRequestInstance
        ): Promise<JetRideInstance>;

        /** Removes a co-rider from the ride
         * + will reject if used on a key rider (owner, driver, provider)
         * + do NOT use to cascade rider updates - use reset instead.*/
        expel(
          rideRider: JetRideRiderInstance,
          newStatus?: JetRiderStatus,
          reactivate?: boolean
        ): Promise<JetRideInstance>;

        /** Removes the owner from the ride in the context of joining another ride, voluntarily leaving or deleting the rider instance.
         * 
         * do NOT use to cascade rider updates - use reset instead.
         * + case A: if there are 2+ riders remaining and the ride is cab-share, these riders will stay within the ride, and one will become owner
         * + case B: if there is 1 other rider, it will reactivate its suspended ride
         * + case C: no other riders: no action needed 
         * 
         * The former owner will then:
         * + case A: if 'suspended' option is elected, the dropped owner will create a new ride and suspend it
         * + case B/C: if 'suspended' option is elected, the owner's ride will be suspended, otherwise it will be deleted
         * @param suspend default=TRUE*/
        dropOwner(suspend?: boolean): Promise<JetRideInstance>;

        /** Removes a coRider from its current ride in the context of cascading updates on this rider making it incompatible with the ride.
         * If the reactivate option is selected, the coRider will re-open its suspended ride, if any
         * If the reset option is selected, the coRider will update the suspended ride
         * @param reactivate default=TRUE
         * @param reset default=FALSE*/
        dropOut(rider: JetRiderInstance, reactivate?: boolean, reset?: boolean): Promise<JetRideInstance>;

        /** Resets the params of a ride in the context of cascading updates from the rider owning the ride.
         * + case A: if there are 2+ riders remaining and the ride is cab-share, these riders will stay within the ride, and one will become owner
         * + case B: if there is 1 other rider, it will reactivate its suspended ride
         * + case C: no other riders: no action needed 
         * 
         * The dissolving owner will then reform or update the ride to match the change:
         * + case A: if 'suspended' option is elected, the dissolving owner will create a new ride and suspend it
         * + case B/C: if 'suspended' option is elected, the owner's ride will be suspended, otherwise it will be deleted
         * @param suspend default=FALSE
         * @param overrideOwner provide to cascade the changes based on this rider rather than the db entry*/
        reset(suspend?: boolean, overrideOwner?: JetRiderInstance): Promise<JetRideInstance>
    }

    interface JetRideInstance extends Instance<JetRideAttributes>, JetRideAttributes, JetRideMethods{
      Riders?: Array<JetRiderInstance>;
      Airport?: JetAirportInstance;
      Agglo?: JetAggloInstance;
      Creator?: JetUserInstance;
      CityStops?: Array<JetNeighborhoodInstance>;
      TerminalStops?: Array<JetTerminalInstance>;

      RidesRiders?: JetRideRiderInstance;
      RiderLinks?: Array<JetRideRiderInstance>;
      RidesTerminals?: Array<JetRideTerminalInstance>;
      RidesNeighborhoods?: Array<JetRideNeighborhoodInstance>;
    }

    interface JetRideModel extends Model<JetRideInstance,JetRideAttributes>{
        /** builds, but does not persist, a ride instance from a rider */
        buildFromRider(rider: JetRiderInstance, type?: JetRideType, public?: boolean): JetRideInstance;
    }
    // ------------------------------------------------------------------------    

    // RIDER -------------------------------------------------------------------
    interface JetRiderAttributes {
        id: string;
        date: Date;
        dep_time: string;
        pref: JetRiderPref;
        toward: JetRideWay;
        seat_count: number;
        luggage_count: number;
        baby_seat_count: number;
        sport_equip_count: number;
        address_id: string;
        neighborhood_id: number;
        airport_id: string;
        terminal_id: number;
        via_id: string;
        creator_id: string;
    }

    interface JetRiderMethods {
        /** Requires Rides & RidesRiders fields populated.
         * @return ride_id*/
        getCurrentRideId(): string;
        /** Requires Rides & RidesRiders fields populated.
         * @return ride_rider_id*/
        getPendingApplicationIds(): Array<string>

        /** Returns formatted response for rider (as viewed by user who can update it) */
        createPrivateResponse(
            riderUser: JetRiderUserAttributes,
            info: JetInfos,
            travMap?: {[travId: string]: JetUserTravelerInstance},
            options?: {
                userTrips?: JetTripUserInstance[],
                via?: JetViaInstance
            }
        ): JetPrivateRiderResponse;

        /** Creates a ride instance, and calls .saveInitial() on it 
         * @param suspend if TRUE, the ride will be created with suspended status: watchout for unique constraint on suspend status*/
        createRide(
            t?: JetTransaction, 
            suspend?: boolean, 
            type?: JetRideType, 
            publicRide?: boolean
        ): Promise<JetRideInstance>;

        createRideOwnerResponse(): JetRideOwnerResponse;
        createRideRiderResponse(
          travUserTravMap?: {[travelerId: string]: JetUserTravelerInstance},
          ordinal?: number,
          ownRider?: JetRiderInstance): JetCurrentRideRiderResponse;


        startTimeCompare(o: JetRiderInstance): number;
        /** Requires RidesRiders to be populated */
        hasJoinedRide(): boolean;
        joinTimeCompare(o: JetRiderInstance): number;

        /** Available fields */
        populate(fields: Array<string>, maps: JetInfos);

        /** Propagate the update of riders to rides, which can only involve changes in terminal, city location, time, flights/airlines
         * 
         * + fetch the related rides, and all the applications to join a ride
         * + update the suspended ride*/
        propagate(rideSpecs?: JetRiderRideSpecs): Promise<boolean>;

        /** Populates field CurrentRide and CurrentRide.RidesRiders */
        fetchCurrentRide(): Promise<void>;
        /** Populates field Applications */
        fetchApplications(): Promise<void>;
        /** Populates field Connections */
        fetchConnections(): Promise<void>;
        /** Populates neighborhood_id and airport_id fields */
        fetchBasicInfos(): Promise<void>;

    }

    interface JetRiderInstance extends Instance<JetRiderAttributes>, JetRiderAttributes, JetRiderMethods{
        Address?: JetAddressInstance;
        Neighborhood?: JetNeighborhoodInstance;
        Airport?: JetAirportInstance;
        Terminal?: JetTerminalInstance;
        via?: JetViaInstance;
        Creator?: JetUserInstance;
        Travelers?: Array<JetTravelerInstance>;
        Users?: Array<JetUserInstance>;
        Rides?: Array<JetRideInstance>;

        RidesRiders?: JetRideRiderInstance;

        Connections?: Array<JetRideRiderInstance>;
        TravelerLinks?: Array<JetRiderTravelerInstance>;
        UserLinks?: Array<JetRiderUserInstance>;

        /** Not an association, to be populated manually in order to update rides/rideRiders on rider update */
        CurrentRide?: JetRideInstance;
        /** Not an association, to be populated manually in order to update rides/rideRiders on rider update */
        Applications?: Array<JetRideRiderInstance>;
    }

    interface JetRiderModel extends Model<JetRiderInstance,JetRiderAttributes>{
        fetchAgglos(riderRequests: Array<JetRiderRequest>): Promise<{[aggloKey: string]: JetAggloInstance}>;
        fetchHoods(riderRequests: Array<JetRiderRequest>): Promise<{[hoodKey: string]: JetNeighborhoodInstance}>;
        fetchAddresses(userId: string, riderRequests: Array<JetRiderRequest>, travMap: {[travId: string]: JetUserTravelerInstance}):
            Promise<{
                userAddressMap: {[userAddressId: string]: JetAddressInstance}, 
                travAddressMap: {[travAddressId: string]: JetAddressInstance}
            }>;

        fetchRequestInfos(
            riderRequests: Array<JetRiderRequest>,
            userId: string,
            travMap: {[travId: string]: JetUserTravelerInstance}
        ): Promise<JetInfos>;

        fetchUpdateRequestInfos(
            riderRequests: Array<JetRiderUpdateRequest>,
            userId: string,
            travMap: {[travId: string]: JetUserTravelerInstance}
        ): Promise<JetInfos>;

        fetchAirports(riderRequests: Array<JetRiderFullRequest>): Promise<{[airportKey: string]: JetAirportInstance}>;
        fetchTerminals(riderRequests: Array<JetRiderFullRequest>): Promise<{[terminalKey: string]: JetTerminalInstance}>;


        getStartTimeChangeScore(minutesChg: number): number;
        getTravChangeScore(prevRider: JetRiderInstance, updateRequest: JetRiderUpdateRequest): number;

        /** Base response from a rider
         * 
         * + used in rider instance method createRideRiderResponse
         * + used in rideRider instance method createPublicResponse*/
        createResponse(
            rider: JetRiderInstance,
            rideRider: JetRideRiderInstance,
            travUserTravMap?: {[travelerId: string]: JetUserTravelerInstance},
            ownRider?: JetRiderInstance
        ): JetRideRiderResponse;
    }
    // ------------------------------------------------------------------------  

    // CONVO ------------------------------------------------------------------
    interface JetConvoAttributes {
        id: string;
        type: JetConvoType;
        ride_id?: string;
        ride_rider_id?: string;
        task_via_traveler_id?: string;
        task_id?: string;
    }

    interface JetConvoMethods {
        createRideRiderMessage(
            ride: JetRideInstance,
            rideRider: JetRideRiderInstance,
            msgReq: JetMessageRequest,
            authorId: string,
            errors: JetErrors
        ): Promise<JetMessageInstance>;

        createTaskTaskerMessage(
            task: JetTaskInstance,
            tasker: JetTaskViaTravelerInstance,
            msgReq: JetMessageRequest,
            authorId: string,
            errors: JetErrors
        ): Promise<JetMessageInstance>;

        populateProvisionalTaskMessages(): void;
        populateViaTaskMessages(): void;

        /** Formats the messages between the applicant and the admins */
        createRideRiderResponse(
            userId: string, 
            ownRideRider: JetRideRiderInstance,
            riders: Array<JetRiderInstance>,
            riderUserRiderMap: {[riderId: string]: Array<JetRiderUserInstance>},
            coRiderRef?: string,
            coRiderUsers?: Array<string>
          ): Array<JetRideMessageResponse>;

        createTaskTaskerResponse(
            userId: string,
            ownMember: JetTaskViaTravelerInstance,
            ownBeneficiary: JetTaskTravelerInstance,
            task: JetTaskInstance
        ): Array<JetTaskerMessageResponse>;
    }

    interface JetConvoInstance extends Instance<JetConvoAttributes>, 
        JetConvoAttributes, JetConvoMethods{
        Ride?: JetRideInstance;
        RideRider?: JetRideRiderInstance;
        GroupViaTraveler?: JetTaskViaTravelerInstance;
        Messages?: Array<JetMessageInstance>;
    }

    interface JetConvoModel extends Model<JetConvoInstance,JetConvoAttributes>{
        buildRideRiderConvo(rideRider: JetRideRiderInstance): JetConvoInstance;
        createRideRiderConvo(rideRider: JetRideRiderInstance): Promise<JetConvoInstance>;
        createTaskTaskerConvo(tasker: JetTaskViaTravelerInstance): Promise<JetConvoInstance>;
    }
    // -----------------------------------------------------------------------

    // MESSAGE ---------------------------------------------------------------
    interface JetMessageAttributes {
        id: string;
        content: string;
        posted_at: Date;
        author_id: string;
        convo_id: string;
        created_at: Date;
        updated_at: Date;
    }

    interface JetMessageMethods {
        postedTimeCompare(oMsg: JetMessageInstance): number;
    }

    interface JetMessageInstance extends Instance<JetMessageAttributes>, 
        JetMessageAttributes, JetMessageMethods{
        Author?: JetUserInstance;
        Convo?: JetConvoInstance;
        RidesRiders?: JetRideRiderInstance;
        ViasTravelers?: JetViaTravelerInstance;
        Users?: Array<JetMessageUserInstance>;
    }

    interface JetMessageModel extends Model<JetMessageInstance,JetMessageAttributes>{
        isValidRequest(
            msgReq: JetMessageRequest,
            errors: {[errorName: string]: string}
        ): boolean;

        buildFromRequest(
            convo: JetConvoInstance,
            msgReq: JetMessageRequest,
            authorId: string,
            errors: {[errorName: string]: string}
        ): JetMessageInstance;
    }
    // -----------------------------------------------------------------------


    // TASK ------------------------------------------------------------------
    interface JetTaskAttributes {
        id: string;
        type: JetTaskType;
        status: JetTaskStatus;

        start_date: Date;
        start_time: string;
        end_date: Date;
        end_time: string;

        earliest_date: Date;
        latest_date: Date;
        earliest_time: string;
        latest_time: string;

        convo_id? : string;
        creator_id?: string;
        flight_id?: string;
        via_id?: string;

        dep_airport_id?: string;
        arr_airport_id?: string;
        dep_neighborhood_id?: number;
        arr_neighborhood_id?: number;
        dep_address_id?: string;
        arr_address_id?: string;
    }

    type DeprecatedTaskRequestExtracts = {
        aggloMap?: {[aggloKey: string]: Array<JetAggloInstance>},
        hoodMap: {[hoodKey: string]: Array<JetNeighborhoodInstance>},

        aggloIdMap: {[aggloId: number]: JetAggloInstance},
        hoodIdMap: {[hoodId: number]: JetNeighborhoodInstance},
        userAddressMap: {[userAddressId: string]: JetAddressInstance},
        travAddressMap: {[travAddressId: string]: JetAddressInstance},

        addressMap?: {[addressId: string]: JetAddressInstance}, // instead of addressIdMap
        airportMap? : {[airportKey: string]: JetAirportInstance}, // instead of airportIdMap
        viaMap?: {[viaKey: string]: JetViaInstance}, // instead of viaIdMap
        travelerMap?: {[travId: string]: JetTravelerInstance}, // instead of travelerIdMap

        flightMap?: {[flightId: string]: JetFlightInstance}, // instead of flightIdMap
        terminalMap?: {[terminalId: number]: JetTerminalInstance}, // instead of terminalIdMap
        airlineMap?: {[airlineId: number]: JetAirlineInstance} // instead of airlineIdMap
    };


    type JetTaskAssembler = {
        task: JetTaskInstance;
        userRef: string;
        members: Array<JetTaskViaTravelerInstance>;
        beneficiaries?: Array<JetTaskTravelerInstance>;
    }

    interface JetTaskMethods {
        dateTimeCompare(o: JetTaskInstance): number;
        earliestDateTimeCompare(o: JetTaskInstance): number;

        /** Populates the missing fields and format to be able to call .createResponse():
         * + airports
         * + neighborhood
         * + addresses
         * + travelers (members {helpees, helper, backups} & beneficiaries)
         * + flights
         * + taskUsersMap {[userId] --> TaskUser instance}
         * 
         * Use only for a single task, otherwise use TaskAssembly.
         * 
         * Provide the last argument if TaskUser is already known.
         * 
         * @param extended: fetch members via if TRUE*/
        populate(
            userId: string, 
            travMap?: {[travelerId: string]: JetTravelerInstance},
            extended?: boolean,
            taskUser?: JetTaskUserInstance
        ): Promise<JetInfos>;

        /** Update the task-via-traveler entries of all entries except "helpees", which are handled directly in PUT/tasks
         * 
         * A member status may either stay the same or become "incompatible" following the changes.
         * Since all task-via-traveler remain associated, there is no need to update task-user instances*/
        propagate(
            infos: JetInfos,
            errors?: JetErrors,
            changeType?: JetChangeType
        ): Promise<JetTaskInstance>;

        /** Update and persist the TaskViaTraveler entries, both in the db and in the task.TasksViasTravelers array
         * 
         * Call updateMembers() afterwards if need to return a response to the front end*/
        applyMemberRequests(
            memberRequests: Array<JetMemberRequest>
        ): Promise<JetTaskInstance>;

        /** Update task.Members entries based on the TasksViasTravelers - if task.Members does not exist, create it*/
        updateMembers(infos: JetInfos): void;

        /** Update task.NonMembers entries based on the TasksViasTravelers - if task.NonMembers does not exist, create it*/
        updateNonTaskers(): void;

        /** Fetches the task id, either directly by task.id or through the members or beneficiaries */
        getId(): string;

        /** @return true if the task is provisional */
        isProvisional(): boolean;

        /** The id of the TasksViasTravelers of the first created member whose status is 'helpee'
         * @return viaRef of the task*/
        getViaRef(): string;

        /** The id of the TaskTraveler of the first created beneficiary
         * If param travMap is provided, restrict beneficiaries to traveler ids present in the map
         * @return travRef of the task*/
        getBeneficiaryRef(travMap? : {[travId: string]: JetUserTravelerInstance}): string;

        /** To be used in tasks (create and update tasks) 
         * @return array of traveler ids of all beneficiaries and members with status 'helpee'*/
        getBeneficiaryTravelerIds(): Array<string>;

        /** To be used in notices - fetch the id of travelers that are beneficiaries or member
         * with a status 'helpee', but agnostic to how the task was populated:
         * + through Members/Beneficiaries Traveler instance, or
         * + directly through TasksTravelers and TasksViasTravelers instances
         * 
         * @return array of traveler ids of all beneficiaries and members with status 'helpee'*/
        getAdminTravelerIds(): Array<string>;

        /** To be used in helpers
         * @return array of traveler ids of all beneficiaries and current members*/
        getTravelerIds(...addlTravIds: Array<string>): Array<string>;

        /** To be used in tasks (create and update tasks)
         * @return array of traveler ids for all members with status 'helpee' */
        getHelpeeIds(): Array<string>;

        getHelper(): JetTaskViaTravelerInstance;
        getTaskers(): Array<JetTaskViaTravelerInstance>;
        getNonTaskers(): Array<JetTaskViaTravelerInstance>;
        getIncompatibles(): Array<JetTaskViaTravelerInstance>;

        /** Requires field .TasksViasTravelers or .Members populated */
        getNextBackupRank(): number;

        /** Arr|Dep airport_ids and arr|dep provisional airports */
        getAirportIds(dep: boolean): string[] | string;

        /** To be used in taskers (find, review and apply for/ join task).
         * 
         * Generate the travId->UserTraveler for the logged user, based on the task's Members and Beneficiaries */
        createTravMap(
            userId: string,
            currentMap?: {[travId: string]: JetUserTravelerInstance}
        ): Promise<{[travId: string]: JetUserTravelerInstance}>;


        // Task method changes:
        /** Admits the member, possibly with a specified status and rank (backup only)*/
        admit(tasker: JetTaskViaTravelerInstance, status: JetHelpStatus, rank?: number): Promise<JetTaskInstance>;

        /** Remove a member and converts it to the specified status, or by default to 'applied' */
        expel(tasker: JetTaskViaTravelerInstance, status?: JetHelpStatus): Promise<JetTaskInstance>;

        /** Promite an existing tasker (backup only) to the main helper */
        promote(tasker: JetTaskViaTravelerInstance, status?: JetHelpStatus, rank?: number): Promise<JetTaskInstance>;


        // Task method responses:
        createResponse(
            userRef: string,
            travMap: {[travId: string]: JetUserTravelerInstance},
            private?: boolean
        ): JetTaskResponse;

        createPrivateResponse(
            userRef: string,
            travMap: {[travId: string]: JetUserTravelerInstance},
            infos: JetInfos
        ): JetPrivateTaskResponse;
    
        createProvisionalResponse(
            userRef: string, 
            travMap: {[travId: string]: JetUserTravelerInstance},
            addProvisionals?: boolean,
            private?: boolean
        ): JetProvisionalTaskResponse;

        createPrivateProvisionalResponse(
            userRef: string, 
            travMap: {[travId: string]: JetUserTravelerInstance},
            infos: JetInfos
        ): JetPrivateProvisionalTaskReponse;

        createFindResponse(
          airportMap: {[airportId: string]: JetAirportInstance},
          membershipMap?: {[taskId: string]: JetTaskViaTravelerInstance},
          userTaskMap?: {[taskId: string]: JetTaskUserInstance},
          travMap?: {[travId: string]: JetUserTravelerInstance}
        ): JetViaTaskFindResponse;

        createProvisionalFindResponse(
          airportMap: {[airportId: string]: JetAirportInstance},
          membershipMap?: {[taskId: string]: JetTaskViaTravelerInstance},
          userTaskMap?: {[taskId: string]: JetTaskUserInstance},
          travMap?: {[travId: string]: JetUserTravelerInstance}
        ): JetProvisionalTaskFindResponse;

        createHelperResponse(
          taskUser?: JetTaskUserInstance,
          travMap?: {[travId: string]: JetUserTravelerInstance},
          curMember?: JetTaskViaTravelerInstance,
          infos?: JetInfos
        ): (JetTaskResponse | JetProvisionalTaskResponse) & JetQuerierTaskMixin;

        createOwnerResponse(
            userId: string,
            travMap?: {[travId: string]: JetUserTravelerInstance},
            infos?: JetInfos
        ): (JetTaskResponse | JetProvisionalTaskResponse);
    }

    interface JetTaskInstance extends Instance<JetTaskAttributes>, JetTaskAttributes, JetTaskMethods{
        Convo?: JetConvoInstance;
        Creator?: JetUserInstance;
        via?: JetViaInstance;
        Flight?: JetFlightInstance;

        DepAirport?: JetAirportInstance;
        ArrAirport?: JetAirportInstance;
        DepNeighborhood?: JetNeighborhoodInstance;
        ArrNeighborhood?: JetNeighborhoodInstance;
        DepAddress?: JetAddressInstance;
        ArrAddress?: JetAddressInstance;

        ProvisionalAirports?: Array<JetAirportInstance>;
        ProvisionalFlights?: Array<JetFlightInstance>;
        Beneficiaries?: Array<JetTravelerInstance>; 
        Members?: Array<JetTravelerInstance>;
        NonTaskers?: Array<JetTaskViaTravelerInstance>;

        TasksViasTravelers?: Array<JetTaskViaTravelerInstance>;
        TasksTravelers?: Array<JetTaskTravelerInstance>;
        TasksUsers?: Array<JetTaskUserInstance>;
        TasksAirports?: Array<JetTaskAirportInstance>;
        TasksFlights?: Array<JetTaskFlightInstance>;

        /** userId->TaskUser populated with User to create convo response */
        taskUsersMap?: {[userId: string]: JetTaskUserInstance};
    }

    interface JetTaskModel extends Model<JetTaskInstance,JetTaskAttributes>{
        /** For use only within Task --- defined here because it needs models and is thus created by .associate() call */
        createCityLocationResponse(
            address: JetAddressInstance, 
            infos: JetInfos, 
            hood?: JetNeighborhoodInstance
        ): JetCityLocationResponse;
    }
    // -----------------------------------------------------------------------


    // TASK-NOTICES ----------------------------------------------------------
    interface JetTaskNoticeAttributes {
        id: string;
        type: JetTaskNoticeType;
        sub_type: JetTaskNoticeSubType;
        side: JetNoticeSide;
        status: JetTaskStatus;
        task_via_traveler_id: string;
        traveler_id: string;
        task_id: string;
        user_id: string;
        updated_at: Date
    }

    interface JetTaskNoticeMethods {
        createResponse(
            userNoticeIdMap?: {[noticeId: string]: JetUserTaskNoticeInstance},
            taskIdMap?: {[taskId: string]: JetTaskUserInstance}
        ): JetTaskNoticeResponse;
    }

    interface JetTaskNoticeInstance extends Instance<JetTaskNoticeAttributes>, 
        JetTaskNoticeAttributes, JetTaskNoticeMethods{
        Notifier?: JetUserInstance;
    }

    interface JetTaskNoticeModel extends Model<JetTaskNoticeInstance,JetTaskNoticeAttributes>{
        buildFromRequest(
            member: JetTaskViaTravelerInstance,
            type: JetTaskNoticeType,
            subType: JetTaskNoticeSubType,
            userId: string,
            side?: JetNoticeSide
        ): JetTaskNoticeInstance;

        inferTypes(
            oldStatus: JetHelpStatus,
            newStatus: JetHelpStatus,
            oldRank?: number,
            newRank?: number
        ): {type: JetTaskNoticeType, subType: JetTaskNoticeType, side: JetNoticeSide};

        
    }

    // -----------------------------------------------------------------------




    // ASSOCIATION TYPES ------------------------------------------------------
    //
    // Defines <name>Attributes, <name>methods, <name>instance and <name>model
    // interfaces for each join table model between two models in the database
    //
    // ------------------------------------------------------------------------
    
    // USERS-TRAVELERS --------------------------------------------------------
    interface JetUserTravelerAttributes {
        id: string;
        user_id: string;
        traveler_id: string;
        primary_user: boolean;
        nickname: string;
        status: JetUserTravelerStatus;
        relation: JetUserTravelerRelation;
        ordinal: number;
    }

    interface JetUserTravelerMethods {
        createResponse(): JetUserTravelerResponse;
        createSelectionResponse(): JetTravelerSelectionResponse;

        /** update, but does not persist, the instance from a userTraveler request 
         * @return true if there were any change*/
        updateFromRequest(user: JetUserInstance, traveler: JetTravelerInstance, travReq: JetUserTravelerRequest): boolean;
    }

    interface JetUserTravelerInstance extends Instance<JetUserTravelerAttributes>, 
        JetUserTravelerAttributes, JetUserTravelerMethods{
            User?: JetUserInstance;
            Traveler?: JetTravelerInstance;
        }

    interface JetUserTravelerModel extends Model<JetUserTravelerInstance,JetUserTravelerAttributes>{
        isValidRequest(userTravReq: JetUserTravelerRequest, errors: JetErrors, travPublicName?: string): boolean;
        /** Finds all userTrav instance associated to a user for a list of traveler ids
         * Possibly alters an existing trav map passed as an optional third argument*/
        createTravUserTravMap(
            userId: string, 
            travIds: Array<string>,
            outMap?: {[travelerId: string]: JetUserTravelerInstance}
        ): Promise<{[travelerId: string]: JetUserTravelerInstance}>;
        createMap(userId: string, userTravIds: Array<string>): Promise<{[userTravId: string]: JetUserTravelerInstance}>;
        createTravsUsersMap(travelerIds: Array<string>): Promise<{[travelerId: string]: Array<JetUserTravelerInstance>}>;
        createUserTravsMap(userId: string): Promise<{[travId: string]: JetUserTravelerInstance}>;
    }
    // -----------------------------------------------------------------------


    // USERS-ADDRESSES -------------------------------------------------------
    interface JetUserAddressAttributes {
        id: string;
        user_id: string;
        address_id: string;
        alias: string;
        type?: JetAddressType;
    }

    interface JetUserAddressMethods {
        updateAndSaveFromFields(fields: JetReferencedAddressRequest): Promise<JetUserAddressInstance>;
    }

    interface JetUserAddressInstance extends Instance<JetUserAddressAttributes>, 
        JetUserAddressAttributes, JetUserAddressMethods{
            User?: JetUserInstance;
            Address?: JetAddressInstance;
        }

    interface JetUserAddressModel extends Model<JetUserAddressInstance,JetUserAddressAttributes>{
        createMap(userId: string, userAddressIds: Array<string>): Promise<{[userAddressId: string]: JetUserAddressInstance}>;
        createAddressMap(userId: string, userAddressIds: Array<string>): Promise<{[userAddressId: string]: JetAddressInstance}>;
        createFullAddressMap(userId: string): Promise<{[userAddressId: string]: JetAddressInstance}>;
        
        findUserAddresses(userId: string, addressIds: Array<string>): Promise<Array<JetUserAddressInstance>>;
    }
    // -----------------------------------------------------------------------


    // TRAVELERS-ADDRESSES ---------------------------------------------------
    interface JetTravelerAddressAttributes {
        id: string;
        traveler_id: string;
        address_id: string;
        alias: string;
        type: JetAddressType;
    }

    interface JetTravelerAddressMethods {
        createSelectionJson(): JetTravelerSelectionResponse;
        updateAndSaveFromFields(fields: JetReferencedAddressRequest): Promise<JetTravelerAddressInstance>;
    }

    interface JetTravelerAddressInstance extends Instance<JetTravelerAddressAttributes>, 
        JetTravelerAddressAttributes, JetTravelerAddressMethods{
            Traveler?: JetTravelerInstance;
            Address?: JetAddressInstance;
        }

    interface JetTravelerAddressModel extends Model<JetTravelerAddressInstance,JetTravelerAddressAttributes>{
        createMap(travId: string, travelerAddressIds: Array<string>): Promise<{[travelerAddressId: string]: JetTravelerAddressInstance}>;
        createAddressMap(
            travAddressIds: Array<string>, 
            travMap: {[travId: string]: JetUserTravelerInstance}
        ): Promise<{[travAddressId: string]: JetAddressInstance}>;
        createFullAddressMap(travIds: Array<string>): Promise<{[travAddressId: string]: JetAddressInstance}>;

        findTravelersAddresses(
            travelerIds: Array<string>, 
            addressIds: Array<string>
        ): Promise<Array<JetTravelerAddressInstance>>;
    }
    // -----------------------------------------------------------------------


    // USERS-PHONES ----------------------------------------------------------
    interface JetUserPhoneAttributes {
        id: string;
        user_id: string;
        phone_id: string;
        alias: string;
    }

    interface JetUserPhoneMethods {
        updateAndSaveFromFields(fields: JetPhoneRequest): Promise<JetUserPhoneInstance>;
    }

    interface JetUserPhoneInstance extends Instance<JetUserPhoneAttributes>, 
        JetUserPhoneAttributes, JetUserPhoneMethods{}

    interface JetUserPhoneModel extends Model<JetUserPhoneInstance,JetUserPhoneAttributes>{
        createMap(userId: string, userPhoneIds: Array<string>): Promise<{[userPhoneId: string]: JetUserPhoneInstance}>;
    }
    // -----------------------------------------------------------------------


    // TRAVELERS-PHONES ------------------------------------------------------
    interface JetTravelerPhoneAttributes {
        id: string;
        traveler_id: string;
        phone_id: string;
        alias: string;
    }

    interface JetTravelerPhoneMethods {
        updateAndSaveFromFields(fields: JetPhoneRequest): Promise<JetTravelerPhoneInstance>;
    }

    interface JetTravelerPhoneInstance extends Instance<JetTravelerPhoneAttributes>, 
        JetTravelerPhoneAttributes, JetTravelerPhoneMethods{}

    interface JetTravelerPhoneModel extends Model<JetTravelerPhoneInstance,JetTravelerPhoneAttributes>{
        createMap(travId: string, travPhoneIds: Array<string>): Promise<{[travPhoneId: string]: JetTravelerPhoneInstance}>;
    }
    // -----------------------------------------------------------------------


    // USERS-EMAILS ----------------------------------------------------------
    interface JetUserEmailAttributes {
        id: string;
        traveler_id: string;
        user_id: string;
    }

    interface JetUserEmailMethods {}

    interface JetUserEmailInstance extends Instance<JetUserEmailAttributes>, 
        JetUserEmailAttributes, JetUserEmailMethods{}

    interface JetUserEmailModel extends Model<JetUserEmailInstance,JetUserEmailAttributes>{
        createMap(userId: string, userEmailIds: Array<string>): Promise<{[userEmailId: string]: JetUserEmailInstance}>;
    }
    // -----------------------------------------------------------------------


    // TRAVELERS-EMAILS ------------------------------------------------------
    interface JetTravelerEmailAttributes {
        id: string;
        traveler_id: string;
        email_id: string;
    }

    interface JetTravelerEmailMethods {}

    interface JetTravelerEmailInstance extends Instance<JetTravelerEmailAttributes>, 
        JetTravelerEmailAttributes, JetTravelerEmailMethods{}

    interface JetTravelerEmailModel extends Model<JetTravelerEmailInstance,JetTravelerEmailAttributes>{
        createMap(travId: string, travEmailIds: Array<string>): Promise<{[travEmailId: string]: JetTravelerEmailInstance}>;
    }
    // -----------------------------------------------------------------------

    // TRIP-USER--------------------------------------------------------------
    interface JetTripUserAttributes {
        id?: string;
        trip_id: string;
        user_id: string;
        alias: string;
    }

    interface JetTripUserMethods {
        /** check constraint on setting the alias, returns true if acceptable alias */
        setAlias(alias: string): boolean;
        createResponse(): {ref: string, alias: string}
    }

    interface JetTripUserInstance extends Instance<JetTripUserAttributes>,JetTripUserAttributes, JetTripUserMethods{
            User?: JetUserInstance;
            Trip?: JetTripInstance;
        }

    interface JetTripUserModel extends Model<JetTripUserInstance,JetTripUserAttributes>{
        buildFromRequest(
            tripRequest: JetTripRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Array<JetTripUserInstance>;

        updateFromRequest(
            tripRequest: JetTripRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>},
            loggedUserId?: string       
        ): {delTripUsers: Array<JetTripUserInstance>, newTripUsers: Array<JetTripUserInstance>, updTripUser: JetTripUserInstance};
    }
    // -----------------------------------------------------------------------



    // VIA-TRAVELER-----------------------------------------------------------
    interface JetViaTravelerAttributes {
        id: string;
        via_id: string;
        traveler_id: string;
        booking_status: JetBookingStatus;
        volunteer: boolean;
    }

    interface JetViaTravelerMethods {
        /** Checks that the dep/arr dates, airports as well as flights are compatible 
         * 
         * Requires that the field Via is populated*/
        isCompatible(task: JetTaskInstance, errors: JetErrors, ind?: number): boolean;
        
        buildMember(task: JetTaskInstance, status: JetHelpStatus): JetTaskViaTravelerInstance;
        
        createPassengerResponse(travMap?: {[travId: string]: JetUserTravelerInstance}): JetPassengerResponse;
        createPassengerFindResponse(
            travMap?: {[travelerId: string]: JetUserTravelerInstance}, 
            infos?: JetInfos
        ): JetPassengerResponse;
    }

    interface JetViaTravelerInstance extends Instance<JetViaTravelerAttributes>, JetViaTravelerAttributes, JetViaTravelerMethods{
        via?: JetViaInstance;
        Traveler?: JetTravelerInstance;

        TasksViasTravelers?: Array<JetTaskViaTravelerInstance>;
    }

    interface JetViaTravelerModel extends Model<JetViaTravelerInstance,JetViaTravelerAttributes>{
        buildFromRequest(
            viaRequest: JetViaRequest,
          ): Array<JetViaTravelerInstance>;

        updateFromRequest(viaRequest: JetViaRequest): {
            delPassengers: Array<JetViaTravelerInstance>,
            newPassengers: Array<JetViaTravelerInstance>,
            chgPassengers: Array<JetViaTravelerInstance>
        };
    }
    // -----------------------------------------------------------------------


    // RIDE-NEIGHBORHOOD------------------------------------------------------
    interface JetRideNeighborhoodAttributes {
        id: Buffer | string;
        ride_id: Buffer | string;
        neighborhood_id: number;
        ordinal: number;
        ride_rider_id: Buffer | string;
    }

    interface JetRideNeighborhoodMethods {
        // nothing for now
    }

    interface JetRideNeighborhoodInstance extends Instance<JetRideNeighborhoodAttributes>, 
        JetRideNeighborhoodAttributes, JetRideNeighborhoodMethods{}

    interface JetRideNeighborhoodModel extends Model<JetRideNeighborhoodInstance,JetRideNeighborhoodAttributes>{}
    // -----------------------------------------------------------------------

    // RIDE-TERMINAL----------------------------------------------------------
    interface JetRideTerminalAttributes {
        id: Buffer | string;
        ride_id: Buffer | string;
        terminal_id: number;
        ordinal: number;
        ride_rider_id: Buffer | string;
    }

    interface JetRideTerminalMethods {
        // nothing for now
    }

    interface JetRideTerminalInstance extends Instance<JetRideTerminalAttributes>, 
        JetRideTerminalAttributes, JetRideTerminalMethods{}

    interface JetRideTerminalModel extends Model<JetRideTerminalInstance,JetRideTerminalAttributes>{}
    // -----------------------------------------------------------------------

    // RIDE-RIDER-------------------------------------------------------------
    interface JetRideRiderAttributes {
        id: string;
        ride_id: string;
        rider_id: string;
        via_traveler_id?: string;
        status: JetRiderStatus;
        joined_at: Date;
        request_id?: string;
        counter_id?: string;
        convo_id?: string;
    }

    interface JetRideRiderMethods {
        setRequest(request: JetRideRiderRequestInstance): Promise<void>;

        /** true if the ride can persist after the rider leaves it (false for driver or provider) */
        mayPersistRide(): boolean;  
        /** true if driver, provider or owner */
        isMainRider(): boolean;

        /** upgrade the status of the rideRider based on the referenced ride*/
        upgrade(ride: JetRideRiderInstance, t?: JetTransaction): Promise<void>;

        /** use to sort remaining rider in a ride after the owner leaves the ride */
        compareTo(o: JetRideRiderInstance): number;

        /** used to provide details of applicant wishing the join a ride */
        createPublicResponse(
          travUserTravMap: {[travelerId: string]: JetUserTravelerInstance}
        ): JetRideRiderResponse;

        /** finds the ride the rider has joined, or returns null */
        findCurrentRide(targetRide?: JetRideInstance): 
            Promise<{curRideRider: JetRideRiderInstance, curRide: JetRideInstance}>;

        /** finds the rider default ride that had been suspended when the rider joined another ride
         * @param toReset default=FALSE*/
        findSuspendRide(toReset?: boolean): Promise<{suspRideRider: JetRideRiderInstance, suspRide: JetRideInstance}>;

        /** rejects an applicant to a ride (must be an owner/admin)*/
        deny(applicant: JetRideRiderInstance): Promise<JetRideRiderInstance>;

        /** destroys the ride-rider link corresponding to the application (testing only - must be an owner/admin) */
        killoff(applicant: JetRideRiderInstance): Promise<null>;
    }

    interface JetRideRiderInstance extends Instance<JetRideRiderAttributes>, 
        JetRideRiderAttributes, JetRideRiderMethods{
            Ride?: JetRideInstance;
            Rider?: JetRiderInstance;
            Request?: JetRideRiderRequestInstance;
            Counter?: JetRideRiderRequestInstance;
            Convo?: JetConvoInstance;
        }

    interface JetRideRiderModel extends Model<JetRideRiderInstance,JetRideRiderAttributes>{
        /** @return rideRiders, populated with Riders, themselves populated with Travelers/RidersTravelers and TravelerLinks*/
        findApplicants(rideIds: Array<string>): Promise<Array<JetRideRiderInstance>>;

        compareTo(r1: JetRideRiderInstance, r2: JetRideRiderInstance): number;
    }
    // -----------------------------------------------------------------------

    // RIDER-TRAVELERS--------------------------------------------------------
    interface JetRiderTravelerAttributes {
        id: string;
        rider_id: string;
        traveler_id: string;
        via_traveler_id: string;
    }

    interface JetRiderTravelerMethods {
        // nothing for now
    }

    interface JetRiderTravelerInstance extends Instance<JetRiderTravelerAttributes>, 
        JetRiderTravelerAttributes, JetRiderTravelerMethods{
            Rider?: JetRiderInstance;
            Traveler?: JetTravelerInstance;
            ViaTraveler?: JetViaTravelerInstance;
        }

    interface JetRiderTravelerModel extends Model<JetRiderTravelerInstance,JetRiderTravelerAttributes>{
        buildFromViaRequest(riderRequest: JetRiderFromViaRequest): Array<JetRiderTravelerInstance>;
        buildFromFullRequest(riderRequest: JetRiderFullRequest): Array<JetRiderTravelerInstance>;
        updateFromRequest(riderRequest: JetRiderUpdateRequest): {
            delRiderTravs: Array<JetRiderTravelerInstance>,
            newRiderTravs: Array<JetRiderTravelerInstance>
        };
        /** Populate rider.Travelers field from travelers query result.
         * @param rider must have TravelerLinks field populated
         * @param travelers must have id field populated*/
        populateTravelers(rider: JetRiderInstance, travelers: Array<JetTravelerInstance>): void;
    }
    // -----------------------------------------------------------------------

    // RIDER-USER-------------------------------------------------------------
    interface JetRiderUserAttributes {
        id: string;
        rider_id: string;
        user_id: string;
    }

    interface JetRiderUserMethods {
        // nothing for now
    }

    interface JetRiderUserInstance extends Instance<JetRiderUserAttributes>, JetRiderUserAttributes, JetRiderUserMethods{
        Rider?: JetRiderInstance;
        User?: JetUserInstance;
    }

    interface JetRiderUserModel extends Model<JetRiderUserInstance,JetRiderUserAttributes>{
        buildFromViaRequest(
          riderRequest: JetRiderFromViaRequest,
          travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Array<JetRiderUserInstance>;
        buildFromFullRequest(
            riderRequest: JetRiderFullRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Array<JetRiderUserInstance>;
        updateFromRequest(riderRequest: JetRiderUpdateRequest, travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}): {
            delRiderUsers: Array<JetRiderUserInstance>,
            newRiderUsers: Array<JetRiderUserInstance>
        };
        createRiderUserRiderMap(riderIds: Array<string>): Promise<{[riderId: string]: Array<JetRiderUserInstance>}>;
    }
    // -----------------------------------------------------------------------


    // SUB-ASSOCIATION TYPES -------------------------------------------------
    //
    // Defines <name>Attributes, <name>methods, <name>instance and <name>model
    // interfaces for each join table model between two models in the database
    //
    // ------------------------------------------------------------------------

    // RIDE-RIDER-REQUEST -----------------------------------------------------
    interface JetRideRiderRequestAttributes {
        id: string;
        counter: boolean;

        ride_rider_id: string;
        start_time: string;
        date: Date;

        seat_count: number;
        luggage_count: number;
        baby_seat_count: number;
        sport_equip_count: number;

        pay_method: JetPayPref;
        smoke_policy: JetSmokePref;
        pet_policy: JetPetPref;
        curb_policy: JetCurbPref;

        close_ride: boolean;

        terminal_id: number;
        terminal_ordinal: number;
        neighborhood_id: number;
        neighborhood_ordinal: number;
    }

    interface JetRideRiderRequestMethods {
        /** Update, but does not persist, the rideRiderRequest from the request of the front-end,
         * fetching the requested neighborhood and terminal if necessary.
         * 
         * Does not create/update or destroy any related terminalDrops or neighborhoodDrops.
        */
        updateFromChangeRequest(changeReq: JetRideChangeRequest, ride: JetRideInstance): Promise<JetRideRiderRequestInstance>;

        /** Update, but does not persist, the rideRiderRequest to match another instance.
         * No need to fetch any neighborhood or terminal in this case.
         */
        conformTo(request: JetRideRiderRequestInstance): void;

        /** + Persist or update the changes of the rideRequest
         * + create missing neighborhoodDrop and terminalDrop instances from the changeRequest
         * + delete neighborhoodDrop and terminalDrop instances no longer referenced in the changeRequest
         * 
         * @param ride must be populated with CityStops and TerminalStops fields, 
         * themselves populated with RidesNeighborhoods and RidesTerminals*/
        saveAndUpdateDrops(ride: JetRideInstance, changeReq: JetRideChangeRequest): Promise<JetRideRiderRequestInstance>;
        
        /** Format response to send to the front-end.
         * 
         * @param ride must be populated with CityStops and TerminalStops fields,
         * themselves populated with RidesNeighborhoods and RidesTerminals*/
        createResponse(ride: JetRideInstance): JetRideChangeResponse;

        differsFrom(oRequest: JetRideRiderRequestInstance): boolean;

        /** Update ride own fields based on the accepted change request 
         * + start time and date
         * + seat/luggage/etc spots
         * + ride policies*/
        modifyRide(ride: JetRideInstance): void;

        /** @return TRUE if ride should be closed on admission, FALSE if should be kept open, null if indifferent*/
        closeRequested(): boolean;
    }

    interface JetRideRiderRequestInstance extends Instance<JetRideRiderRequestAttributes>, 
        JetRideRiderRequestAttributes, JetRideRiderRequestMethods{
        
        RequestedNeighborhood?: JetNeighborhoodInstance;
        RequestedTerminal?: JetTerminalInstance;
        NeighborhoodDrops?: Array<JetNeighborhoodDropInstance>;
        TerminalDrops?: Array<JetTerminalDropInstance>;
    }

    interface JetRideRiderRequestModel extends Model<JetRideRiderRequestInstance,JetRideRiderRequestAttributes>{
        isValidChangeRequest(changeReq: JetRideChangeRequest, errors: {[errorType: string]: string}): boolean;

        /** Builds, but does not persist the rideRiderRequest from the changeRequest of the front-end, 
         * fetching the requested neighborhood and terminal if necessary.
         * 
         * Does not create/update or destroy any related terminalDrops or neighborhoodDrops*/
        buildFromChangeRequest(
            changeReq: JetRideChangeRequest, 
            rideRider: JetRideRiderInstance,
            ride: JetRideInstance,
            counter?: boolean
        ): Promise<JetRideRiderRequestInstance>;
    }
    // -----------------------------------------------------------------------


    // NEIGHBORHOOD_DROP -----------------------------------------------------
    interface JetNeighborhoodDropAttributes {
        city_stop_id: string;
        ride_rider_request_id: string;
    }

    interface JetNeighborhoodDropMethods {}

    interface JetNeighborhoodDropInstance extends Instance<JetNeighborhoodDropAttributes>, 
        JetNeighborhoodDropAttributes, JetNeighborhoodDropMethods{}

    interface JetNeighborhoodDropModel extends Model<JetNeighborhoodDropInstance,JetNeighborhoodDropAttributes>{}
    // -----------------------------------------------------------------------

    // TERMINAL_DROP -----------------------------------------------------
    interface JetTerminalDropAttributes {
        terminal_stop_id: string;
        ride_rider_request_id: string;
    }

    interface JetTerminalDropMethods {}

    interface JetTerminalDropInstance extends Instance<JetTerminalDropAttributes>, 
        JetTerminalDropAttributes, JetTerminalDropMethods{}

    interface JetTerminalDropModel extends Model<JetTerminalDropInstance,JetTerminalDropAttributes>{}
    // -----------------------------------------------------------------------
    
    // MESSAGE-USER ----------------------------------------------------------
    interface JetMessageUserAttributes {
        user_id: string;
        message_id: string;
        status: JetMessageStatus;
    }

    interface JetMessageUserMethods {}

    interface JetMessageUserInstance extends Instance<JetMessageUserAttributes>, 
        JetMessageUserAttributes, JetMessageUserMethods{}

    interface JetMessageUserModel extends Model<JetMessageUserInstance,JetMessageUserAttributes>{}
    // -----------------------------------------------------------------------

    // TASK-VIA-TRAVELER -----------------------------------------------------
    interface JetTaskViaTravelerAttributes {
        id: string;
        task_id: string;
        traveler_id: string;
        via_id: string;
        via_traveler_id: string;
        convo_id?: string;
        status: JetHelpStatus;
        rank: number;
        created_at: Date;
    }

    interface JetTaskViaTravelerMethods {
        /** @return TRUE if the taskViaTraveler is authorized to view the task destination / origin address */
        isAuthorized(): boolean;

        /** @return difference of status priority (helpee=0, helper=1, backup=2, otherwise 100), 2nd order filter by rank */
        statusCompare(oMember: JetTaskViaTravelerInstance): number;

        toMember(travelerMap: {[travelerId: string]: JetTravelerInstance}): JetTravelerInstance;
        toNonTasker(
            travelerMap: {[travelerId: string]: JetTravelerInstance},
            viaMap: {[viaId: string]: JetViaInstance}
        ): JetTaskViaTravelerInstance;

        /** Create a beneficiary from a member when reverting a via task to a provisional task */
        buildBeneficiary(): JetTaskTravelerInstance;

        /** Requires .Traveler field to be populated */
        createMemberResponse(travMap?: {[travelerId: string]: JetUserTravelerInstance}): JetTaskMemberResponse;

        createFindMemberResponse(
          travMap?: {[travelerId: string]: JetUserTravelerInstance}, 
          infos?: JetInfos
        ): JetTaskMemberResponse;

        populateVia(infos: JetInfos): boolean;

        /**
         * Following the update of a via, check member's compatibility to a task, and if change is detected,
         * creates the object to be passed as parameter to models.handlers.task.updateTaskers*/
        createMemberUpdate(): {member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number};

        /** saves the instance and async creates the related notice.
         * 
         * Note: throws an error if the member.Task is not populated.*/
        saveAndNotify(
            prevStatus: JetHelpStatus,
            prevRank?: number,
            userId?: string,
            opt?: sequelize.InstanceSaveOptions
        ): Promise<JetTaskViaTravelerInstance>;
    }

    interface JetTaskViaTravelerInstance extends Instance<JetTaskViaTravelerAttributes>, 
        JetTaskViaTravelerAttributes, JetTaskViaTravelerMethods{
            Task?: JetTaskInstance;
            Traveler?: JetTravelerInstance;
            via?: JetViaInstance;
            ViaTraveler?: JetViaTravelerInstance;
            Convo?: JetConvoInstance;
        }

    interface JetTaskViaTravelerModel extends Model<JetTaskViaTravelerInstance,JetTaskViaTravelerAttributes>{
        buildFromViaRequest(taskRequest: JetTaskRequestFromVia): Array<JetTaskViaTravelerInstance>;
        updateFromViaRequest(taskRequest: JetFromViaTaskUpdateRequest): {
            newTaskViaTravelers: Array<JetTaskViaTravelerInstance>,
            delTaskViaTravelerIds: Array<string>;
        },
        createMembershipsMap(viaTravId: string): Promise<{[taskId: string]: JetTaskViaTravelerInstance}>;
        /** Check before running the task queries */
        prevalidateMemberRequests(
            memberRequests: Array<JetMemberRequest>, 
            errors: JetErrors): boolean;
        /** Check after retrieving the task
         * + populates .member
         * + performs compatibility check between current member status and requested status*/
        isValidMemberRequest(
            task: JetTaskInstance,
            memberRequest: JetMemberRequest, 
            errors: JetErrors, 
            index?: number
        ): boolean;

        /** eligible fields:
         * + task
         * + potentially: passengers, travelers, vias
         */
        populate(
          members: Array<JetTaskTravelerInstance>,
          fields: Array<string>
        ): Promise<Array<JetTaskTravelerInstance>>
    }
    // -----------------------------------------------------------------------

    // TASK-USER -------------------------------------------------------------
    interface JetTaskUserAttributes {
        id: string;
        user_id: string;
        task_id: string;
    }

    interface JetTaskUserMethods {}

    interface JetTaskUserInstance extends Instance<JetTaskUserAttributes>, 
        JetTaskUserAttributes, JetTaskUserMethods{
            User?: JetUserInstance;
            Task?: JetTaskInstance;
        }

    interface JetTaskUserModel extends Model<JetTaskUserInstance,JetTaskUserAttributes>{
        buildFromProvisionalRequest(
            taskRequest: JetProvisionalTaskRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Array<JetTaskUserInstance>;

        buildFromViaRequest(
            taskRequest: JetTaskRequestFromVia,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Array<JetTaskUserInstance>;

        updateProvisionalRequest(
            taskRequest: JetProvisionalTaskRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): {delTaskUserIds: Array<string>, newTaskUsers: Array<JetTaskUserInstance>};

        updateFromViaRequest(
            taskRequest: JetFromViaTaskUpdateRequest,
            travUsersMap: {[travId: string]: Array<JetUserTravelerInstance>}
        ): {delTaskUserIds: Array<string>, newTaskUsers: Array<JetTaskUserInstance>};

        /** Use when updating a task
         * + fetches existing task user instances
         * + fetches all users associated with the travelers associated to this task
         * 
         * Then compares them a finds taskUserId to be deleted, and creates taskUser instances to be persisted */
        updateTaskUsers(
            task: JetTaskInstance,
            updTaskViaTravelers: Array<JetTaskViaTravelerInstance>,
            updTaskTravelers: Array<JetTaskTravelerInstance>,
            travUsersMap?: {[travId: string]: Array<JetUserTravelerInstance>}
        ): Promise<{delTaskUserIds: Array<string>, newTaskUsers: Array<JetTaskUserInstance>}>;

        createUserTasksMap(userId: string): Promise<{[taskId: string]: JetTaskUserInstance}>;

        /** Map of userId --> taskUser:
         * + populated with user
         * + itself populated with all the travelers*/
        createTaskUsersMap(taskId: string): Promise<{[userId: string]: JetTaskUserInstance}>;

        /** Builds - but does not persist - the new taskUser instance resulting from adding new members
         * +all new members must belong to same task
         * +if not provided, will fetch the current taskUser
         * +will fetch missing traveler-users*/
        buildTaskUsers(
            newMembers: Array<JetTaskViaTravelerInstance>,
            taskUsersMap?: {[userId: string]: JetTaskUserInstance},
            travsUsersMap?: {[travelerId: string]: Array<JetUserTravelerInstance>}
        ): Promise<Array<JetTaskUserInstance>>;
    }
    // -----------------------------------------------------------------------

    // TASK-TRAVELER ---------------------------------------------------------
    interface JetTaskTravelerAttributes {
        id: string,
        traveler_id: string;
        task_id: string;
        created_at?: Date;
    }

    interface JetTaskTravelerMethods {
        createdAtCompare(oBeneficiary: JetTaskTravelerInstance): number;
        /** Converts the taskTrav instance to the traveler instance, populated with the taskTraveler*/
        toBeneficiary(travelerMap: {[travelerId: string]: JetTravelerInstance}): JetTravelerInstance;
    }

    interface JetTaskTravelerInstance extends Instance<JetTaskTravelerAttributes>, 
        JetTaskTravelerAttributes, JetTaskTravelerMethods{
            Traveler?: JetTravelerInstance;
            Task?: JetTaskInstance;
        }

    interface JetTaskTravelerModel extends Model<JetTaskTravelerInstance,JetTaskTravelerAttributes>{
        buildFromProvisionalRequest(taskRequest: JetProvisionalTaskRequest): Array<JetTaskTravelerInstance>;
        updateProvisionalRequest(taskRequest: JetProvisionalTaskUpdateRequest): {
            delTaskTravelerIds: Array<string>,
            newTaskTravelers: Array<JetTaskTravelerInstance>
        };
    }
    // -----------------------------------------------------------------------

    // TASK-AIRPORT ----------------------------------------------------------
    interface JetTaskAirportAttributes {
        airport_id: string;
        task_id: string;
        neighborhood_id: number;
        bound: JetViaBound;
    }

    interface JetTaskAirportMethods {

        /** Converts the TaskAirport instance into Airport instance populated with TaskAirport
         * itself populated with Neighborhood.*/
        toProvisionalAirport(
            airportMap: {[airportId: string]: JetAirportInstance},
            hoodMap: {[hoodId: number]: JetNeighborhoodInstance}
        ): JetAirportInstance;
    }

    interface JetTaskAirportInstance extends Instance<JetTaskAirportAttributes>, 
        JetTaskAirportAttributes, JetTaskAirportMethods{
            Airport?: JetAirportInstance;
            Task?: JetTaskInstance;
            Neighborhood?: JetNeighborhoodInstance;
        }

    interface JetTaskAirportModel extends Model<JetTaskAirportInstance,JetTaskAirportAttributes>{
        buildFromRequest(taskRequest: JetProvisionalTaskRequest): Array<JetTaskAirportInstance>;
        updateProvisionalRequest(taskRequest: JetProvisionalTaskUpdateRequest): {
            /** Since TaskAirport primary key is {task_id-airport_id}, the function returns the instances to be deleted */
            delTaskAirports: Array<JetTaskAirportInstance>,
            newTaskAirports: Array<JetTaskAirportInstance>,
            /** Existing taskAirport that only need to update their neighborhood reference (if the dep / arr address has changed)*/
            updTaskAirports: Array<JetTaskAirportInstance>
        }
    }
    // -----------------------------------------------------------------------

    // TASK-FLIGHT -----------------------------------------------------------
    interface JetTaskFlightAttributes {
        flight_id: string;
        task_id: string;
    }

    interface JetTaskFlightMethods {
        toFlight(flightMap: {[flightId: string]: JetFlightInstance}): JetFlightInstance;
    }

    interface JetTaskFlightInstance extends Instance<JetTaskFlightAttributes>, 
        JetTaskFlightAttributes, JetTaskFlightMethods{
            Flight?: JetFlightInstance;
            Task?: JetTaskInstance;
        }

    interface JetTaskFlightModel extends Model<JetTaskFlightInstance,JetTaskFlightAttributes>{}
    // -----------------------------------------------------------------------

    // USER-TASK-NOTICE ------------------------------------------------------
    interface JetUserTaskNoticeAttributes {
        id: string;
        task_notice_id: string;
        user_id: string;
        status: JetUserNoticeStatus;
        task_admin: boolean;
    }

    interface JetUserTaskNoticeMethods {
        // NOTHING for now
    }

    interface JetUserTaskNoticeInstance extends Instance<JetUserTaskNoticeAttributes>, 
        JetUserTaskNoticeAttributes, JetUserTaskNoticeMethods{}

    interface JetUserTaskNoticeModel extends Model<JetUserTaskNoticeInstance,JetUserTaskNoticeAttributes>{
        createUsersTaskNotices(
            taskNoticeId: string, 
            userIds: {admins: string[], taskers: string[]}
        ): Promise<JetUserTaskNoticeInstance[]>;

        /** First, finds all user-taskNotice instances associated with noticeId and all userIds, then:
         * + Delete user-TaskNotice whose user-id
         * + Existing notice: update status to 'pending'
         * + Missing notices: create instance with status 'pending'*/
        createOrUpdateUsersTaskNotices(
            noticeId: string,
            userIds: {admins: string[], taskers: string[]}
        ): Promise<void>;
    }

    // -----------------------------------------------------------------------


    // MODEL HANDLERS ---------------------------------------------------------
    //
    // Non-model / instance methods that manipulate one or several models
    // or instances within a single transaction passed as argument
    //
    // ------------------------------------------------------------------------

    // CONVO-HANDLER ----------------------------------------------------------
    interface JetConvoHandler {
        /** Utility to update the convo between a rider to all ride admins convo:
        * + may create or update the convo instance
        * + creates the message based on the msgRequest
        * + creates the user-message association entries
        * + update, but does not persist, the rideRider entry's field: 'convo_id'
        * 
        * Remember to save the rideRider entry afterwards if the convo did not exist.
        * @param convo associated with the rideRider (may be null)*/
       rideRiderSaver(
           convo: JetConvoInstance,
           ride: JetRideInstance,
           rideRider: JetRideRiderInstance,
           userId: string,
           msgRequest: JetMessageRequest,
           errors: JetErrors
       ): () => Promise<JetConvoInstance>;

       taskerSaver(
           convo: JetConvoInstance,
           task: JetTaskInstance,
           tasker: JetTaskViaTravelerInstance,
           userId: string,
           msgRequest: JetMessageRequest,
           errors: JetErrors,
           toHelpees?: boolean
       ): () => Promise<JetConvoInstance>;
    }
    // ------------------------------------------------------------------------

    // TRIP-HANDLER -----------------------------------------------------------
    interface JetTripHandler {
        /** Handles addition/removal of vias without hitting the constraint [trip_id,ordinal] */
        updateVias(
            trip: JetTripInstance,
            finalVias: Array<JetViaInstance>,
            remainingVias: Array<JetViaInstance>,
            deletedVias: Array<JetViaInstance>,
            t?: Transaction
        ): Promise<JetTripInstance>;
    }
    // ------------------------------------------------------------------------

    // RIDE-HANDLER -----------------------------------------------------------
    interface JetRideHandler {
        
        /** Handle addition and removal of rideNeighborhood / rideTerminal,
        * including updating their ordinal fields, ensure that the constraint
        * [ride_stop_id,ordinal] is respected for each of these tables.*/
        updateStops(
            ride: JetRideInstance,
            newRideRiderStopId: string,
            reqCityStop: {neighborhood_id: number, ordinal: number},
            reqTerminalStop: {terminal_id: number, ordinal: number},
            toRemoveCityStopIds: Array<string>,
            toRemoveTermStopIds: Array<string>,
            t?: JetTransaction,
            rideOwner?: JetRiderInstance,
        ): Promise<void>;

        /** Removes ALL remaining riders from a ride except the owner.
        * Riders removed this way will reactivate their suspended ride, if any.*/
        removeRiders(
            ride: JetRideInstance,
            t?: JetTransaction,
            owner?: JetRiderInstance,
        ): Promise<JetRideInstance>;

        /** Removes one rider, which may not be the owner of the rider.
        * The rider removed will reactivate its suspended ride, if any.*/
        removeCoRider(
            ride: JetRideInstance,
            coRider: JetRiderInstance,
            t?: JetTransaction,
            newStatus?: JetRiderStatus,
            reactivate?: boolean,
            reset?: boolean
        ): Promise<{updatedRide: JetRideInstance, coRiderRide: JetRideInstance}>;

        /** Suspend the ride
        * 
        * Rejects if there are coRiders left in the ride or if there is no owner*/
        suspendRide(
            ride: JetRideInstance,
            t?: JetTransaction
        ): Promise<JetRideInstance>;

        /**
         * When the rider of a ride gets expelled from a ride, or end up alone in a ride he/she joined:
         * + finds the original ride of this rider that was suspended
         * + reactivate it
         * @param reset when set to true, reset the suspended ride to match exactly the rider
         * @param coRider only when resetting a ride with a coRider following the departure of a third rider who was imposing a constraint
         */
        reactivateSuspendedRide(
            rideRider: JetRideRiderInstance,
            t?: Transaction,
            reset?: boolean,
            /** only set upon reset */
            coRider?: JetRiderInstance
        ): Promise<JetRideRiderInstance>;

        /** Resets the ride to match the specs of the owner
        * 
        * Rejects if there are coRiders left in the ride*/
        resetRide(
            ride: JetRideInstance,
            t?: JetTransaction,
            suspend?: boolean,
            owner?: JetRiderInstance,
            ownerLink?: JetRideRiderInstance
        ): Promise<JetRideInstance>;

        resetRideStops(
            ride: JetRideInstance,
            t?: JetTransaction,
            owner?: JetRiderInstance,
            ownerLink?: JetRideRiderInstance
        ): Promise<JetRideInstance>;

        /** When the owner of a cabsharing ride leaves (either joining another ride or effecting breaking change to the rider),
        * the remanining riders keep the existing ride and one of them becomes owner.
        * 
        * Requires 2+ coRiders in the ride.
        * 
        * @param postSpinOffHandler used to create a ride for the spinOff user*/
        spinOff(
            ride: JetRideInstance,
            postSpinOffHandler: (t: JetTransaction) => Promise<JetRideInstance>,
            t?: JetTransaction
        ): Promise<JetRideInstance>;

        /** Cascade deletion of riders to rides
         * 
         * + fetch the related rides
         * + if ride is empty of riders after rider deletion, delete the ride
         * + if one of the deleted riders is the ride owner:
         * - -  if >= 2 riders left: promote remaining riders, remove deleted riders airport/terminal stops and keep ride
         * - -  if 1 rider left: reactive suspended ride
         * + if deleted rider(s) are coriders
         * - - drop deleted riders airport/terminal stops*/
        cascade(
            deletedRiders: Array<JetRiderInstance>,
            t?: Transaction
        ): Promise<void>;

        /** Propagate the update of riders to rides, which can only involve changes in terminal, city location, time, flights/airlines
         * 
         * + fetch the related rides
         * + update the suspended ride*/
        propagate(
            updatedEntries: Array<{rider: JetRiderInstance, createRide: boolean}>,
            infos?: JetInfos,
            t?: Transaction
        ): Promise<void>;
    }

    class JetTaskAssembly {
        get(taskId: string): JetTaskAssembler;
        addBeneficiaries(...beneficiaries: Array<JetTaskTravelerInstance>): void;
        addMembers(...members: Array<JetTaskViaTravelerInstance>): void;
        addTasksUsers(...taskUsers: Array<JetTaskUserInstance>): void;
        addTasks(...tasks: Array<JetTaskInstance>): void;
        getTaskIds(): Array<string>;
        getTasks(): Array<JetTaskInstance>;
        has(taskId: string): boolean;
        restrictMembers(travMap: {[travId: string]: JetUserTravelerInstance}): void;
        queryTasks(): Promise<void>;

        mapReferences(
            airportIds: {[airportId: string]: boolean},
            hoodIds: {[hoodId: number]: boolean},
            addressIds: {[addressId: string]: boolean},
            travelerIds: {[travelerId: string]: boolean}
        ): void;

        /** retrieves the via ids (own tasks only)*/
        mapVias(viaIds: {[viaId: string]: boolean}): void

        assemble(
            infos: JetInfos,
            userTasksMap: {[taskId: string]: JetTaskUserInstance}
        ): void;

        createResponses(
            travMap: {[travId: string]: JetUserTravelerInstance},
            infos: JetInfos
        ): Array<JetTaskResponse | JetPrivateTaskResponse | JetProvisionalTaskResponse | JetPrivateProvisionalTaskReponse>;
    }

    interface JetTaskAssemblyClass {
        createAssembly(type: JetTaskAssemblerType): JetTaskAssembly; 
    }

    interface JetTaskHandler {
        /** wrapper enabling calls even if taskIds is empty */
        fetchViaTasks(taskIds: Array<string>): Array<JetTaskInstance>;
        /** wrapper enabling calls even if taskIds is empty */
        fetchProvisionalTasks(taskIds: Array<string>): Array<JetTaskInstance>;

        /** In the case where the dep / arr cityLocation is a custom address: 
         * 
         * + populates the country / state / city of the address based on {latitude,longitude}
         * + fetches the most appropriate neighborhood for each airport
         * + populate the taskRequest.dep/arrAirports->hood field*/
        populateCustAddressProvisionalHoods(
           taskRequest: JetProvisionalTaskRequest,
           dep: boolean
        ): Promise<void>;

        /** In the case where the dep / arr cityLocation is a custom address:
         * 
         * + populates the country / state / city of the address based on {latitude,longitude}
         * + fetches the most appropriate neighborhood given the departure or arrival airport
         * + populate the task.dep/arr_neighborhood_id, task.Dep/ArrNeighborhood and taskRequest.Dep/ArrNeighborhood*/
        populateCustAddressTaskHood(
            taskRequest: JetTaskRequestFromVia,
            dep: boolean
        ): Promise<void>;

        /** In the case where the dep / arr cityLocation is an existing address referenced by userRef or travelerRef: 
         * 
         * + fetches the most appropriate neighborhood for each airport
         * + populate the taskRequest.dep/arrAirports->hood field*/
        populateExistAddressProvisionalHoods(
            taskRequest: JetProvisionalTaskRequest,
            dep: boolean
        ): Promise<void>;

        /** In the case where the dep / arr cityLocation is an existing address referenced by userRef or travelerRef
         * 
         * + fetches the most appropriate neighborhood for the departure or arrival airport
         * + pulate the taskRequest.Dep/ArrAirport, task.dep/arr_airport_id and task.Dep/ArrAirport*/
        populateExistAddressTaskHood(
            taskRequest: JetTaskRequestFromVia,
            dep: boolean
        ): Promise<void>;

        /** Handles change of taskers
         * + only allows for one helper
         * + compares existing backup and current backup, and update accordingly
         * 
         * Makes sure to respect the unique constraints:
         * + [task_id, status = 'helper']
         * + [task_via_traveler_id,ordinal,status='backup']
         *
         * In addition:
         * + ensures that all backups ranks remain 0,1,2,... without missing entries
         * + if new backup promoted, inserts previous helper has backup
         * + if previous helper is removed without replacement, tries to promote an existing backup that is not 
         * in the updatedMembers list, picking the lowest possible rank among these remaining backups*/
        updateTaskers(
            task: JetTaskInstance,
            updatedMembers: Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>,
            t?: Transaction
        ): Promise<JetTaskInstance>;

        /** Associates a task to a via, making it a "via task"
         * 
         * + fails if the task is already associated to a via
         * + automatically updates the members list to reflect the passenger of this via
         * + automatically updates the dep_airport, arr_airport, start_date, start_time*/
        link(
            task: JetTaskInstance,
            via: JetViaInstance,
            exceptPassengerIds?: Array<string>,
            t?: Transaction
        ): Promise<JetTaskInstance>;

        /** Removes association between a task and a via, making it a "provisional task"
         * 
         * + dep|arr airport automatically convert to provisional airports, and populate the neighborhood_id based 
         * on the task.neighborhood_id or task.address_id
         * + start_date --> to earliest_date = latest_date
         * + converts the taskViaTraveler entries with status "helpees" to taskTraveler
         * + by default, does not limit flight and time*/
        unlink(
            task: JetTaskInstance,
            t?: Transaction
        ): Promise<JetTaskInstance>;

        /** Cascade deletion of passengers to tasks
         * 
         * + if pax.TasksViasTravelers fields is not populated, fetches it
         * + fetches the requested tasks
         * + update them after removing the deleted members*/
        cascade(
            deletedPassengers: Array<JetViaTravelerInstance>,
            t?: Transaction
        ): Promise<void>;

        /** After removal of tasker(s), promote any remaining backup and ensure proper backup ranks while
         * ensuring to respect the constraints:
         * + [task_id, status = 'helper']
         * + [task_via_traveler_id,ordinal,status='backup']
         * 
         * @param tasks instances with .TasksViasTravelers and .TasksTravelers populated and 
         * .TasksViasTravelers filtered for passengers that were removed*/
        cascadeTaskers(
            tasks: Array<JetTaskInstance>,
            t?: Transaction
        ): Promise<void>;
    }


    // FETCH HANDLER ------------------------------------------------------------

    interface JetFetchHandler{
        /** Fetches all field specified in the request simultanously, then combine in a @type {JetInfos} object */
        fields(
            request: JetFetchRequests,
            opt?: {
                userId?: string,
                travMap?: {[travId: string]: JetUserTravelerInstance},
                extend?: Array<JetExtendOption>
            }
        ): Promise<JetInfos>;

        /** Fetches and add to the infos output:
         * + .travMap [travId] -> userTraveler
         * + .userAddressIds [userAddressId] -> address
         * + .travAddressIds [travAddressId] -> address
         */
        addresses(
            userId: string,
            userAddressIds: Array<string>,
            travAddressIds: Array<string>,
            travMap?: {[travId: string]: JetUserTravelerInstance}
        ): Promise<JetInfos>;
    }

    interface JetFetchRequests {
        [fetchLabel: string]: Array<string | number>;
    }

    /** Generic interface for a container grouping object instance organized in map*/
    interface JetInfos {
        aggloMap: {[aggloKey: string]: Array<JetAggloInstance>};
        hoodMap: {[hoodKey: string]: Array<JetNeighborhoodInstance>};
        terminalMap: {[terminalKey: string]: JetTerminalInstance};
        potentialAirlines: Array<JetAirlineInstance>;
        
        userTravMap: {[userTravId: string]: JetUserTravelerInstance};
        userAddressMap: {[userAddressId: string]: JetAddressInstance};
        travAddressMap: {[travAddressId: string]: JetAddressInstance};
        airlineIataMap: {[iata: string]: JetAirlineInstance};
        airlineIcaoMap: {[icao: string]: JetAirlineInstance};
        
        travMap: {[travId: string]: JetUserTravelerInstance};

        airportIdMap : {[airportId: string]: JetAirportInstance};
        terminalIdMap: {[terminalId: string]: JetTerminalInstance};
        aggloIdMap: {[aggloId: number]: JetAggloInstance};
        hoodIdMap: {[hoodId: number]: JetNeighborhoodInstance};
        addressIdMap: {[addressId: string]: JetAddressInstance};
        travelerIdMap: {[travId: string]: JetTravelerInstance};
        viaIdMap: {[viaId: string]: JetViaInstance};
        airlineIdMap: {[airlineId: number]: JetAirlineInstance};
        flightIdMap: {[flightId: string]: JetFlightInstance};

        tripUserIdMap?: {[tripId: string]: JetTripUserInstance};
    }

    // ------------------------------------------------------------------------ 


    // NOTICE-HANDLER ---------------------------------------------------------
    interface JetNoticeHandler {

        /** Creates - or updates - a single taskNotice and the user-taskNotice
         * instances associated.*/
        dispatchTaskNotice(
            member: JetTaskViaTravelerInstance,
            helpeeIds: string[],
            type: JetTaskNoticeType,
            subType: JetTaskNoticeSubType,
            userId: string,
            side: JetNoticeSide,
            travUsersMap?: {[travelerId: string]: JetUserTravelerInstance[]}
        ): Promise<boolean>;

        /** Creates - or updates - multiple task notices at once.
         * 
         * Saves time by querying the user-traveler table only once.*/
        dispatchTaskNotices(
            requests: {
                member: JetTaskViaTravelerInstance,
                helpeeIds: string[],
                type: JetTaskNoticeType,
                subType: JetTaskNoticeSubType,
                side: JetNoticeSide
            }[],
            userId: string
        ): Promise<boolean>;

        handleNoticeError(desc: string, error: Error): void;
    }

    interface JetTaskNoticeInfos {
        prevStatus: JetHelpStatus;
        prevRank?: number;
        userId?: string;
        side?: JetNoticeSide
    }
    // ------------------------------------------------------------------------



    // INPUT MANAGERS ---------------------------------------------------------
    //
    // Format inputs from the front-end into usable object:
    // .validate methods: validate a request before sending any query to the database
    // .populate methods: use infos fetched to populate the requests
    // .build: build, but does not persist, an instance
    // .get: provide infos (generally in the form of array of id) about the requests
    //
    // ------------------------------------------------------------------------
    interface JetInputManager<F,V,P,B,G> {
        fetch: F,
        validate: V;
        populate: P;
        build: B;
        get: G
    }

    interface JetRiderInputManager extends JetInputManager<
        JetRiderFetcher,
        JetRiderValidator,
        JetRiderPopulator,
        JetRiderBuilder,
        JetRiderGetter
    >{}
    
    interface JetTripInputManager extends JetInputManager<
        JetTripFetcher,
        JetTripValidator,
        JetTripPopulator,
        JetTripBuilder,
        JetTripGetter
    >{}

    interface JetTaskInputManager extends JetInputManager<
        JetTaskFetcher,
        JetTaskValidator,
        JetTaskPopulator,
        JetTaskBuilder,
        JetTaskGetter
    >{}
    

    // TRIP INPUT MANAGER -----------------------------------------------------
    interface JetTripFetcher{
        infos(tripRequests: Array<JetTripRequest>, userId: string): Promise<JetInfos>;
    }

    interface JetTripValidator{
        /** Checks the validity of a trip request, including all the attached via requests */
        request(
            tripRequest: JetTripRequest, 
            ind: number, 
            errors: JetErrors, 
            isUpdate?: boolean
        ): boolean;

        /** Checks the validity of a via request.*/
        viaRequest(
            viaRequest: JetViaRequest, 
            ind: number, 
            errors: JetErrors, 
            isUpdate?: boolean
        ): boolean;
    }

    interface JetTripPopulator{
        /** Add for each viaRequest of each tripRequest:
         * + dep.airport, dep.terminal
         * + arr.airport, arr.terminal
         * + flight.airline
         * + travelers-> traveler.userTraveler
         * @returns FALSE if any of the requested refs above cannot be found*/
        requests(
            tripRequests: Array<JetTripRequest>,
            infos: JetInfos,
            errors: JetErrors,
        ): Promise<boolean>;

        /** Compares a viaRequest with its .via field and set viaRequest.update param as 'add', 'chg', 'del' or 'idm' */
        updateRequest(
            tripRequest: JetTripRequest, 
            infos: JetInfos,
            errors: JetErrors
        ): boolean;
    }

    interface JetTripBuilder{
        trip(tripRequest: JetTripRequest, userId: string): JetTripInstance;
        via(trip: JetTripInstance, viaRequest: JetViaRequest): JetViaInstance;
        /** Builds, but does not persist, the via instances
         * 
         * tripRequest->vias should be populated for [arr|dep]->terminal, [arr|dep]->airport and flight.airline*/
        request(tripRequest: JetTripRequest): Array<JetViaInstance>;
        
        updateVia(via: JetViaInstance, viaRequest: JetViaRequest): void;
    }

    interface JetTripGetter{
        /** all viaRequest->travelers->userTraveler must be populated */
        travelerIds(tripRequests: Array<JetTripRequest>): Array<string>;

        /** Requires tripRequest.vias.travelers.userTraveler to be populated 
         * 
         * Provides the travelerIds of the vias of this trips after the change request*/
        finalTravelerIds(tripRequest: JetTripRequest): Array<string>;
    }
    // ------------------------------------------------------------------------



    // RIDER INPUT MANAGER ----------------------------------------------------
    interface JetRiderFetcher {
        infos(
            userId: string,
            riderRequests: Array<JetRiderRequest>,
        ): Promise<JetInfos>;

        fullInfos(
            userId: string,
            riderRequests: Array<JetRiderFullRequest>
        ): Promise<JetInfos>;

        updateInfos(
            userId: string,
            riders: Array<JetRiderInstance>,
            updateRequests: Array<JetRiderUpdateRequest>
        ): Promise<JetInfos>;
    }

    interface JetRiderValidator{
        /** Checks the validity of a Rider request to be created from Via or from scratch*/
        request(riderRequest: JetRiderRequest, ind: number, errors: JetErrors, fromVia: boolean): boolean;

        /** Checks the validity of an update an existing rider instance, be it linked to a via or not*/
        updateRequest(riderRequest: JetRiderUpdateRequest, ind: number, errors: JetErrors): boolean;
    }

    interface JetRiderPopulator{
        cityStop(
            riderRequest: JetRiderRequest,
            infos: JetInfos,
            index: number,
            errors: JetErrors,
            findHood: (riderReq: JetRiderRequest, index: number, errors: JetErrors) => JetNeighborhoodInstance
        ): boolean;

        /** Populates riderRequest.travelers->viaTraveler and returns FALSE if one cannot be matched.*/
        viaTravelers(
            riderRequest: JetRiderFromViaRequest,
            infos: JetInfos, 
            index: number, 
            errors: JetErrors, 
        ): boolean;

        /** populate fields riderReq.travelers->userTraveler and returns null if a traveler request cannot be matched */
        fullTravelers(
            riderRequests: JetRiderFullRequest, 
            infos: JetInfos,
            index: number,
            errors: JetErrors, 
        ): boolean;

        /** Populates riderRequest.cityLocation.neighborhood .agglo .address and .travelers->viaRef 
         * @return FALSE if one cannot be matched*/
        fromViaRequests(
            vias: Array<JetViaInstance>,
            riderRequests: Array<JetRiderFromViaRequest>,
            infos: JetInfos,
            errors: JetErrors
        ): boolean;

        /** Populates riderRequest.airportLocation.airport .terminal
         * and riderRequest.cityLocation .address and .travelers->userRef 
         * @return FALSE if one cannot be matched*/
        fullRequests(
            riderRequests: Array<JetRiderFullRequest>,
            infos: JetInfos,
            errors: JetErrors
        ): boolean;

        updateRequests(
            riderRequests: Array<JetRiderUpdateRequest>,
            infos: JetInfos,
            errors: JetErrors
        ): boolean;

        /** Finds the best neighborhood to associate to the address, given the gateway airport */
        missingHoodFromVia(requests: Array<JetRiderFromViaRequest>): Promise<void>;
        
        /** Finds the best neighborhood to associate to the address, given the airport provided in the request*/
        missingHoodFromFull(requests: Array<JetRiderFullRequest>): Promise<void>;

        /** Finds the best neighborhood to associate to the address, provided that the agglo may not change */
        missingHoodUpdate(requests: Array<JetRiderUpdateRequest>): Promise<void>;
    }

    interface JetRiderBuilder {
        /** Builds, but does not save, a rider instance from a riderRequest referencing a via
         * @param {JetRiderFromViaRequest} riderRequest with a populated refVia field*/
        fromVia(riderRequest: JetRiderFromViaRequest, creatorId: string): JetRiderInstance;

        /** Builds, but does not save, a rider instance from a riderRequest
         * @param {JetRiderFullRequest} riderRequest with a populated airport field*/
        fromFull(riderRequest: JetRiderFullRequest, creatorId: string): JetRiderInstance;
    }

    interface JetRiderGetter {
        fullTravelerIds(riderRequests: Array<JetRiderFullRequest>): Array<string>;
        viaTravelerIds(riderRequests: Array<JetRiderFromViaRequest>): Array<string>;
        updateTravelerIds(riderRequests: Array<JetRiderUpdateRequest>): Array<string>;
        unlinkedAddressIds(riderRequests: Array<JetRiderUpdateRequest>): Array<string>;
    }
    // ------------------------------------------------------------------------


    // TASK INPUT MANAGER -----------------------------------------------------
    interface JetTaskFetcher {
        /** Fetches agglos & hoods (by name), addresses and airports (populated with associated agglos)*/
        provisionalInfos(
            userId: string,
            taskRequests: Array<JetProvisionalTaskRequest>
        ): Promise<JetInfos>;

        /** Fetch agglos & hoods (by name) and addresses 
         * Also fetches trips linked to these tasks, populated with the vias*/
        viaInfos(
            userId: string,
            taskRequests: Array<JetTaskRequestFromVia>,
            userTrips: Array<JetTripUserInstance>,
            travMap?: {[travId: string]: JetUserTravelerInstance}
        ): Promise<{
            infos: JetInfos, 
            tripMaps: {
                tripUserMap: {[userTripId: string]: JetTripInstance;};
                airportIdMap: {[airportId: string]: JetAirportInstance;};
                aggloIdMap: {[aggloId: number]: JetAggloInstance;};
            }
        }>;

        /** Fetch agglos & hoods (by name) and addresses */
        updateInfos(
            userId: string,
            all: Array<JetBaseTaskRequest & JetTaskUpdateMixin>
        ): Promise<JetInfos>;

        /** Once the tasks have been retrieved, fetch and update infos with:
         * + all referenced vias (for task linked to a via) with the currently associated hood, itself populated with its agglo
         * + vias of all members except "helpees"
         * + addresses, hoods and airports linked to the tasks but not referenced in the requests
         * 
         * This will enable to remove the links between address / hoods / airports and tasks that are no longer valid
         * In the case the address was solely linked to a task (single purpose), will delete it
         */
        existingInfos(
            infos: JetInfos,
            all: Array<JetBaseTaskRequest & JetTaskUpdateMixin>,
            provisionals: Array<JetProvisionalTaskUpdateRequest>,
            fromVias: Array<JetFromViaTaskUpdateRequest>
        ): Promise<void>;

        /**
         * Returns JetInfos populated with maps:
         * + agglo by id
         * + hood by id
         * + airport by id (extended for agglos)
         * + traveler by id
         * + address by id (extended for city, state, country and address infos)
         * + userAddress and travAddress
         * + via by id
         * 
         * Also populates the field UsersAddresses and TravelersAddresses of each address instance, wherever an association is found
         */
        reviewInfos(
            assemblies: Array<JetTaskAssembly>,
            userId: string,
            travMap: {[travId: string]: JetUserTravelerInstance},
            potentialHelpees: JetViaTravelerInstance[]
        ): Promise<JetInfos>;

        provisionals(taskIds: Array<string>): Promise<Array<JetTaskInstance>>;
        fromVias(taskIds: Array<string>): Promise<Array<JetTaskInstance>>;

        /** Add address extended by city, state, country and address infos into infos.addressIdMap */
        extendedAddresses(infos: JetInfos): Promise<void>;
 
        /** In the case where the dep / arr cityLocation is a custom address: 
         * 
         * + populates the country / state / city of the address based on {latitude,longitude}
         * + fetches the most appropriate neighborhood for each airport
         * + populate the taskRequest.dep/arrAirports->hood field
         * 
         * In the case where the dep / arr cityLocation is an existing address referenced by userRef or travelerRef: 
         * 
         * + fetches the most appropriate neighborhood for each airport
         * + populate the taskRequest.dep/arrAirports->hood field
        * */       
        provisionalHoods(provisionals: Array<JetProvisionalTaskRequest>): Promise<void>;

        /** In the case where the dep / arr cityLocation is a custom address:
         * 
         * + populates the country / state / city of the address based on {latitude,longitude}
         * + fetches the most appropriate neighborhood given the departure or arrival airport
         * + populate the task.dep/arr_neighborhood_id, task.Dep/ArrNeighborhood and taskRequest.Dep/ArrNeighborhood
         *
         * In the case where the dep / arr cityLocation is an existing address referenced by userRef or travelerRef
         * 
         * + fetches the most appropriate neighborhood for the departure or arrival airport
         * + populate the taskRequest.Dep/ArrAirport, task.dep/arr_airport_id and task.Dep/ArrAirport*
         * */
        boundHoods(fromVias: Array<JetTaskRequestFromVia>): Promise<void>;
    }

    interface JetTaskValidator {
        provisional(request: JetProvisionalTaskRequest, index: number, errors: JetErrors): boolean;
        /** check validity of a via request - on success, will add .members populated with the {viaRef passenger id}*/
        fromVia(request: JetTaskRequestFromVia, index: number, errors: JetErrors): boolean;
        provisionalUpdate(request: JetProvisionalTaskUpdateRequest, index: number, errors: JetErrors): boolean;
        fromViaUpdate(request: JetFromViaTaskUpdateRequest, index: number, errors: JetErrors): boolean;

        /** If there is a departure or arrival city location:
         * 
         * + checks whether each provisional airport was mapped to a neighborhood
         * + adds such neighborhood to the infos.hoodIdMap*/
        provisionalHoods(
            taskRequest: JetProvisionalTaskRequest,
            infos: JetInfos,
            errors: JetErrors,
            tInd: number
        ): boolean;

        /** If there is a departure or arrival city location:
         * 
         * + checks whether the address / hood was mapped to hood associated with an agglo of the dep / arr airport
         * + adds such neighborhood to the infos.hoodIdMap*/
        hoods(
            taskRequest: JetTaskRequestFromVia,
            infos: JetInfos,
            errors: JetErrors,
            tInd: number
        ): boolean;

        /** Checks that the task is associated to the logged user
         * on success, populate .taskUser on the task update request
         */
        update(
            userId: string,
            userTasks: Array<JetTaskUserInstance>,
            request: JetBaseTaskRequest & JetTaskUpdateMixin,
            errors: JetErrors, 
            ind?: number
        ): boolean;
    }

    interface JetTaskBuilder {
        provisional(
            request: JetProvisionalTaskRequest,
            creator: string
        ): JetTaskInstance;

        fromVia(
            request: JetTaskRequestFromVia,
            creator: string
        ): JetTaskInstance;

        update(
            taskRequest: JetBaseTaskRequest & JetTaskUpdateMixin,
            unlinkedAddresses?: {[addressId: string]: boolean}
        ): void;

        updateFromVia(
            taskRequest: JetFromViaTaskUpdateRequest,
            unlinkedAddresses?: {[addressId: string]: boolean}
        ): void;
        
        updateProvisional(
            taskRequest: JetProvisionalTaskUpdateRequest,
            unlinkedAddresses?: {[addressId: string]: boolean}
        ): void;
    }

    interface JetTaskPopulator {
        provisionalRequests(
            requests: Array<JetProvisionalTaskRequest>, 
            infos: JetInfos, 
            travMap: {[travId: string]: JetUserTravelerInstance},
            errors: JetErrors
        ): boolean;

       fromViaRequests(
            requests: Array<JetTaskRequestFromVia>,
            infos: JetInfos,
            tripMap: {[userTripId: string]: JetTripInstance},
            errors: JetErrors
        ): boolean;

        fromViaUpdateRequests(
            requests: Array<JetFromViaTaskUpdateRequest>,
            infos: JetInfos,
            travMap: {[travId: string]: JetUserTravelerInstance},
            errors: JetErrors
        ): boolean;

        /** Determine the change type for the provisional task update request, so that to decide what to do with non-helpee task-via-traveler
         *  instances associated with the task:
         * + 'minimal': no need to update any member status
         * + 'restrictive': no need to check incompatible members, check exisitings to see if still compatible
         * + 'expanding': no need to check existing members, check incompatibles to see if became compatible
         * + 'breaking: check both existing and incompatible members*/
        changeType(request: JetProvisionalTaskUpdateRequest): void;
    }

    interface JetTaskGetter{
        beneficiaryIds(
            requests: Array<JetProvisionalTaskRequest>,
            isUpdate?: boolean
        ): Array<string>;

        fromViaMemberIds(
            requests: Array<JetTaskRequestFromVia>,
            isUpdate?: boolean
        ): Array<string>;


    }
    // ------------------------------------------------------------------------

}

