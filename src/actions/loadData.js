/*eslint dot-notation: 0*/
/*eslint-env browser*/
/*eslint no-console: 0*/
import { updateColorScale, updateNodeColors } from "./colors";
import { dataURLStem } from "../util/globals";
import * as types from "./types";
import d3 from "d3";
import { updateVisibleTipsAndBranchThicknesses } from "./treeProperties";
import { turnURLtoDataPath } from "../util/urlHelpers";
import queryString from "query-string";

/* if the metadata specifies an analysis slider, this is where we process it */
const addAnalysisSlider = (dispatch, tree, controls) => {
  /* we can now get the range of values for the analysis slider */
  const vals = tree.nodes.map((d) => d.attr[controls.analysisSlider.key])
    .filter((n) => n !== undefined)
    .filter((item, i, ar) => ar.indexOf(item) === i);
  /* check that the key is found in at least some nodes */
  if (!vals.length) {
    dispatch({
      type: types.ANALYSIS_SLIDER,
      destroy: true
    });
    /* dispatch warning / error message */
    console.log("Analysis slider key ", controls.analysisSlider.key, " never found in tree. Skipping.");
  } else {
    dispatch({
      type: types.ANALYSIS_SLIDER,
      destroy: false,
      maxVal: Math.round(d3.max(vals) * 100) / 100,
      minVal: Math.round(d3.min(vals) * 100) / 100
    });
  }
};

/* request sequences */

const requestSequences = () => {
  return {
    type: types.REQUEST_SEQUENCES
  };
};

const receiveSequences = (data) => {
  return {
    type: types.RECEIVE_SEQUENCES,
    data: data
  };
};

const sequencesFetchError = (err) => {
  return {
    type: types.SEQUENCES_FETCH_ERROR,
    data: err
  };
};

const fetchSequences = (q) => {
  return fetch(
    dataURLStem + q + "_sequences.json"
  );
};

const populateSequencesStore = (queryParams) => {
  return (dispatch) => {
    dispatch(requestSequences());
    return fetchSequences(queryParams).then((res) => res.json()).then(
      (json) => {
        dispatch(receiveSequences(json));
        dispatch(updateColorScale());
        dispatch(updateNodeColors());
      },
      (err) => dispatch(sequencesFetchError(err))
    );
  };
};

/* request frequencies */
const requestFrequencies = () => {
  return {
    type: types.REQUEST_FREQUENCIES
  };
};

const receiveFrequencies = (data) => {
  return {
    type: types.RECEIVE_FREQUENCIES,
    data: data
  };
};

const frequenciesFetchError = (err) => {
  return {
    type: types.FREQUENCIES_FETCH_ERROR,
    data: err
  };
};

const fetchFrequencies = (q) => {
  return fetch(
    dataURLStem + q + "_frequencies.json"
  );
};

const populateFrequenciesStore = (queryParams) => {
  return (dispatch) => {
    dispatch(requestFrequencies());
    return fetchFrequencies(queryParams).then((res) => res.json()).then(
      (json) => dispatch(receiveFrequencies(json)),
      (err) => dispatch(frequenciesFetchError(err))
    );
  };
};

/* request entropyes */
const requestEntropy = () => {
  return {
    type: types.REQUEST_ENTROPY
  };
};

const receiveEntropy = (data) => {
  return {
    type: types.RECEIVE_ENTROPY,
    data: data
  };
};

const entropyFetchError = (err) => {
  return {
    type: types.ENTROPY_FETCH_ERROR,
    data: err
  };
};

const fetchEntropy = (q) => {
  return fetch(
    dataURLStem + q + "_entropy.json"
  );
};

const populateEntropyStore = (queryParams) => {
  return (dispatch) => {
    dispatch(requestEntropy());
    return fetchEntropy(queryParams).then((res) => res.json()).then(
      (json) => dispatch(receiveEntropy(json)),
      (err) => dispatch(entropyFetchError(err))
    );
  };
};


const loadMetaAndTreeJSONs = (metaPath, treePath, router) => {
  return (dispatch, getState) => {
    const metaJSONpromise = fetch(metaPath)
      .then((res) => res.json());
    const treeJSONpromise = fetch(treePath)
      .then((res) => res.json());
    Promise.all([metaJSONpromise, treeJSONpromise])
      .then((values) => {
        /* initial dispatch sets most values */
        dispatch({
          type: types.NEW_DATASET,
          meta: values[0],
          tree: values[1],
          query: queryString.parse(router.history.location.search)
        });
        dispatch({type: types.RECEIVE_METADATA, data: values[0]});
        const {controls, tree} = getState(); // reflects updated data
        /* add analysis slider (if applicable) */
        if (controls.analysisSlider) {
          addAnalysisSlider(dispatch, tree, controls);
        }
        /* there still remain a number of actions to do with calculations */
        dispatch(updateVisibleTipsAndBranchThicknesses());
        dispatch(updateColorScale());
        dispatch(updateNodeColors());
        /* validate the reducers */
        dispatch({type: types.DATA_VALID});
      })
      .catch((err) => {
        /* note that this catches both 404 type errors AND
        any error from the reducers */
        console.log("loadMetaAndTreeJSONs error:", err);
        // dispatch error notification
      });
  };
};

export const loadJSONs = (router) => {
  return (dispatch) => {
    dispatch({type: types.DATA_INVALID});
    const data_path = turnURLtoDataPath(router);
    const JSONpaths = {
      meta: dataURLStem + data_path + "_meta.json",
      tree: dataURLStem + data_path + "_tree.json"
    };
    dispatch(loadMetaAndTreeJSONs(JSONpaths.meta, JSONpaths.tree, router));
    dispatch(populateSequencesStore(data_path));
    /* while nextstrain is limited to ebola & zika, frequencies are not needed */
    // dispatch(populateFrequenciesStore(data_path));
    dispatch(populateEntropyStore(data_path));
  };
};
