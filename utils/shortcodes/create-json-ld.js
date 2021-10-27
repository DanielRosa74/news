const fullEscaper = require('../full-escaper');
const { sourceApiUrl } = require('../ghost/api');
const translate = require('../translate');

// This counts on all images, including the site logo, being stored like on Ghost with the
// same directory structure
const domainReplacer = (url) => url.replace(sourceApiUrl, process.env.SITE_URL);

async function createJsonLdShortcode(type, site, data) {
  // Main site settings from site object
  const { logo, cover_image, image_dimensions } = site;
  const url = `${site.url}/`;
  const typeMap = {
    index: 'WebSite',
    article: 'Article',
    author: 'Person',
    tag: 'Series',
  };
  const baseData = {
    '@context': 'https://schema.org',
    '@type': typeMap[type],
    publisher: {
      '@type': 'Organization',
      name: 'freeCodeCamp.org',
      url: url,
      logo: {
        '@type': 'ImageObject',
        url: domainReplacer(logo),
        width: image_dimensions.logo.width,
        height: image_dimensions.logo.height,
      },
    },
    image: {
      '@type': 'ImageObject',
      url: domainReplacer(cover_image),
      width: image_dimensions.cover_image.width,
      height: image_dimensions.cover_image.height,
    },
    url: url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
  const returnData = { ...baseData };

  const createImageObj = (url, obj) => {
    let { width, height } = obj;

    return {
      '@type': 'ImageObject',
      url,
      width,
      height,
    };
  };

  // Conditionally set other properties based on
  // objects passed to shortcodes
  const createAuthorObj = (primaryAuthor) => {
    const {
      name,
      profile_image,
      image_dimensions,
      website,
      twitter,
      facebook,
    } = primaryAuthor;
    const authorObj = {
      '@type': 'Person',
      name,
      url: domainReplacer(url), // check again later when using slugs throughout template and leaving URLs untouched
      sameAs: [
        website ? fullEscaper(website) : null,
        facebook ? `https://www.facebook.com/${facebook}` : null,
        twitter ? twitter.replace('@', 'https://twitter.com/') : null,
      ].filter((url) => url),
    };

    if (profile_image) {
      authorObj.image = createImageObj(
        profile_image,
        image_dimensions.profile_image
      );
    }

    return authorObj;
  };

  if (type === 'index')
    returnData.description = translate('meta:description');

  if (type !== 'index' && data) {
    // Remove first slash from path
    if (data.path) returnData.url += data.path.substring(1);

    if (data.description)
      returnData.description = fullEscaper(data.description);

    if (type === 'article') {
      if (data.published_at)
        returnData.datePublished = new Date(data.published_at).toISOString();
      if (data.updated_at)
        returnData.dateModified = new Date(data.updated_at).toISOString();
      if (data.tags && data.tags.length > 1) {
        // Filter out internal Ghost tags
        const keywords = data.tags
          .map((tag) => tag.name)
          .filter((keyword) => !keyword.startsWith('#'));

        returnData.keywords = keywords.length === 1 ? keywords[0] : keywords;
      }
      if (data.excerpt) returnData.description = fullEscaper(data.excerpt);
      if (data.title) returnData.headline = fullEscaper(data.title);

      if (data.feature_image) {
        returnData.image = await createImageObj(
          data.feature_image,
          data.image_dimensions.feature_image
        );
      }

      returnData.author = await createAuthorObj(data.primary_author);
    }

    // Handle images for both types
    if (type === 'tag' || type === 'author') {
      if (data.cover_image) {
        returnData.image = createImageObj(
          data.cover_image,
          data.image_dimensions.cover_image
        );
      } else if (data.feature_image) {
        returnData.image = createImageObj(
          data.feature_image,
          data.image_dimensions.feature_image
        );
      } else {
        delete returnData.image;
      }
    }

    if (type === 'tag') {
      if (data.cover_image)
        returnData.image = createImageObj(
          data.cover_image,
          data.image_dimensions.cover_image
        );
      returnData.name = data.name;
    }

    if (type === 'author') {
      // This schema type is the only one without publisher info
      delete returnData.publisher;
      const authorObj = await createAuthorObj(data);

      returnData.sameAs = authorObj.sameAs;
      returnData.name = fullEscaper(authorObj.name);
    }
  }

  return JSON.stringify(returnData, null, '\t'); // Pretty print for testing
  // return JSON.stringify(returnData);
}

module.exports = createJsonLdShortcode;