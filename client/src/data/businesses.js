// Local JavaScript data/config file containing multiple businesses

export const businesses = {
  "demo-waffle-shop": {
    name: "Demo Waffle Shop",
    type: "waffle shop",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"
  },

  "royal-cafe": {
    name: "Royal Cafe",
    type: "cafe",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ3S4Uqc-uEmsRpdAnqj1k58s"
  },

  "fresh-mart": {
    name: "Fresh Mart",
    type: "grocery store",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJyeZ2_D-vEmsRLXo7H7P5v5Q"
  },

  "xyz-bar": {
    name: "XYZ Bar",
    type: "cocktail bar",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJdd4hrwug2EcRmSrV3Vo6llI"
  }
};

export function getBusinessBySlug(slug) {
  if (!slug) return null;
  const key = slug.toLowerCase();
  if (businesses[key]) {
    return {
      slug: key,
      ...businesses[key]
    };
  }
  return null;
}

export function getAllBusinesses() {
  return Object.entries(businesses).map(([slug, data]) => ({
    slug,
    ...data
  }));
}
