import numpy as np
import math
import umap


print('load vectors')
data = np.load('../data/all_users_normalized.npy')

#np.random.shuffle(data)
#data = data[:100000]

print('calculate umap 2d')
result = umap.UMAP(n_components=2, min_dist = 0.03, n_neighbors = 100, random_state=42, verbose=True).fit_transform(data)

print('save results 2d')
#np.save('../data/vectors/subsample_2d.npy', result)
np.savetxt('../data/all_users_2d.tsv', result, '%08f', '\t')

