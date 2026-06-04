import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() => runApp(const TukaApp());

class TukaApp extends StatelessWidget {
  const TukaApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tuka',
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      home: const FilteredChallengeScreen(),
    );
  }
}

class FilteredChallengeScreen extends StatefulWidget {
  const FilteredChallengeScreen({super.key});
  @override
  State<FilteredChallengeScreen> createState() => _FilteredChallengeScreenState();
}

class _FilteredChallengeScreenState extends State<FilteredChallengeScreen> {
  String _filter = 'around'; // around, anywhere, only
  String _city = '';
  List<dynamic> _challenges = [];
  bool _loading = false;

  // 📍 Mock user location (replace with geolocator later)
  final double _userLat = 0.3476;
  final double _userLng = 32.5825;

  Future<void> _fetchChallenges() async {
    setState(() => _loading = true);
    try {
      String url = 'http://10.0.2.2:3000/api/challenges?filter=$_filter';
      if (_filter == 'around') url += '&lat=$_userLat&lng=$_userLng&radius=25';
      if (_filter == 'only' && _city.isNotEmpty) url += '&city=$_city';

      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        setState(() => _challenges = json.decode(res.body));
      }
    } catch (e) {
      debugPrint('❌ Fetch error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void initState() { super.initState(); _fetchChallenges(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('⛏️ Tuka - Earn Now')),
      body: Column(
        children: [
          // 🔽 FILTER BAR
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.blue[50],
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _filter,
                    decoration: const InputDecoration(labelText: 'Filter By'),
                    items: const [
                      DropdownMenuItem(value: 'around', child: Text('📍 Around Me')),
                      DropdownMenuItem(value: 'anywhere', child: Text('🌍 Anywhere (Remote)')),
                      DropdownMenuItem(value: 'only', child: Text('🏙️ Only In City')),
                    ],
                    onChanged: (v) => setState(() => _filter = v!),
                  ),
                ),
                if (_filter == 'only')
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: SizedBox(
                      width: 120,
                      child: TextField(
                        decoration: const InputDecoration(hintText: 'City'),
                        onChanged: (v) => setState(() => _city = v),
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _loading ? null : _fetchChallenges,
                  icon: const Icon(Icons.search),
                  label: const Text('Go'),
                ),
              ],
            ),
          ),

          // 📋 RESULTS
          _loading
              ? const Expanded(child: Center(child: CircularProgressIndicator()))
              : _challenges.isEmpty
                  ? const Expanded(child: Center(child: Text('No challenges match your filter.')))
                  : Expanded(
                      child: ListView.builder(
                        itemCount: _challenges.length,
                        itemBuilder: (context, i) {
                          final c = _challenges[i];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            child: ListTile(
                              leading: Icon(
                                c['type'] == 'REMOTE' ? Icons.cloud_outlined : Icons.location_on,
                                color: c['type'] == 'REMOTE' ? Colors.blue : Colors.red,
                              ),
                              title: Text(c['title']),
                              subtitle: Text('${c['sponsor']} • ${c['type']}'),
                              trailing: c['distance'] != null
                                  ? Text('${c['distance']} km', style: TextStyle(color: Colors.grey[700]))
                                  : null,
                            ),
                          );
                        },
                      ),
                    ),
        ],
      ),
    );
  }
}
